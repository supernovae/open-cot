#!/usr/bin/env python3
"""Train a Qwen adapter with Transformers + PEFT."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any


def _load_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rows.append(json.loads(line))
    return rows


def _write_run_config(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model-name", default="Qwen/Qwen2.5-1.5B-Instruct")
    parser.add_argument("--train-file", type=Path, required=True)
    parser.add_argument("--val-file", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--epochs", type=int, default=1)
    parser.add_argument("--batch-size", type=int, default=1)
    parser.add_argument("--learning-rate", type=float, default=2e-4)
    parser.add_argument("--max-length", type=int, default=1024)
    parser.add_argument("--gradient-accumulation-steps", type=int, default=8)
    parser.add_argument("--lora-r", type=int, default=16)
    parser.add_argument("--lora-alpha", type=int, default=32)
    parser.add_argument("--lora-dropout", type=float, default=0.05)
    parser.add_argument("--use-4bit", action="store_true", help="Enable 4-bit QLoRA loading (GPU + bitsandbytes)")
    parser.add_argument("--dry-run", action="store_true", help="Write config and exit")
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)
    run_cfg = {
        "model_name": args.model_name,
        "train_file": str(args.train_file),
        "val_file": str(args.val_file),
        "epochs": args.epochs,
        "batch_size": args.batch_size,
        "learning_rate": args.learning_rate,
        "max_length": args.max_length,
        "gradient_accumulation_steps": args.gradient_accumulation_steps,
        "lora_r": args.lora_r,
        "lora_alpha": args.lora_alpha,
        "lora_dropout": args.lora_dropout,
        "use_4bit": args.use_4bit,
        "dry_run": args.dry_run,
    }
    _write_run_config(args.output_dir / "training_config.json", run_cfg)

    if args.dry_run:
        print("Dry run complete. Training config written.")
        return 0

    # Delayed imports keep lightweight tests independent from heavy ML deps.
    import torch
    from datasets import Dataset
    from peft import LoraConfig, TaskType, get_peft_model
    from transformers import (
        AutoModelForCausalLM,
        AutoTokenizer,
        DataCollatorForLanguageModeling,
        Trainer,
        TrainingArguments,
    )

    tokenizer = AutoTokenizer.from_pretrained(args.model_name)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    quantization_config = None
    torch_dtype = None
    device_map: str | None = "auto"
    if args.use_4bit:
        try:
            from transformers import BitsAndBytesConfig
        except ImportError as e:
            raise RuntimeError("4-bit requested but BitsAndBytesConfig unavailable. Install bitsandbytes.") from e
        quantization_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
        )
    else:
        torch_dtype = torch.float16 if torch.cuda.is_available() else torch.float32

    model = AutoModelForCausalLM.from_pretrained(
        args.model_name,
        device_map=device_map,
        torch_dtype=torch_dtype,
        quantization_config=quantization_config,
    )

    lora_config = LoraConfig(
        task_type=TaskType.CAUSAL_LM,
        r=args.lora_r,
        lora_alpha=args.lora_alpha,
        lora_dropout=args.lora_dropout,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "up_proj", "down_proj", "gate_proj"],
    )
    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()

    def _tokenize(batch: dict[str, list[str]]) -> dict[str, Any]:
        return tokenizer(batch["text"], truncation=True, max_length=args.max_length, padding=False)

    train_rows = _load_jsonl(args.train_file)
    val_rows = _load_jsonl(args.val_file)
    train_ds = Dataset.from_list(train_rows).map(_tokenize, batched=True, remove_columns=list(train_rows[0].keys()))
    val_ds = Dataset.from_list(val_rows).map(_tokenize, batched=True, remove_columns=list(val_rows[0].keys()))

    training_args = TrainingArguments(
        output_dir=str(args.output_dir / "checkpoints"),
        num_train_epochs=args.epochs,
        per_device_train_batch_size=args.batch_size,
        per_device_eval_batch_size=args.batch_size,
        gradient_accumulation_steps=args.gradient_accumulation_steps,
        learning_rate=args.learning_rate,
        logging_steps=10,
        save_strategy="epoch",
        eval_strategy="epoch",
        report_to=[],
        fp16=torch.cuda.is_available(),
        bf16=False,
        dataloader_num_workers=max(1, (os.cpu_count() or 2) // 2),
    )
    collator = DataCollatorForLanguageModeling(tokenizer=tokenizer, mlm=False)
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_ds,
        eval_dataset=val_ds,
        data_collator=collator,
    )
    trainer.train()
    trainer.save_model(str(args.output_dir / "adapter"))
    tokenizer.save_pretrained(str(args.output_dir / "adapter"))
    print(f"Saved adapter to {args.output_dir / 'adapter'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
