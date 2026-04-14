# RFC 0024 — Multi‑Modal Reasoning Schema (v0.1)
**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026‑04‑14  
**Target Version:** Schema v0.5  
**Discussion:** https://github.com/<your-org>/<your-repo>/issues/24

---

## 1. Summary

This RFC defines a **multi‑modal extension** to the reasoning schema, enabling agents to reason over:

- text  
- images  
- audio  
- video  
- structured data  
- embeddings  

It extends:

- RFC 0001 — Reasoning Schema  
- RFC 0004 — Branching Reasoning Extensions  

---

## 2. Modalities

- `text`  
- `image`  
- `audio`  
- `video`  
- `table`  
- `embedding`  

---

## 3. Full Schema (JSON)

    {
      "step_id": "s1",
      "type": "observation",
      "modality": "image",
      "content": {
        "image_ref": "img_001"
      }
    }

---

## 4. Example

    {
      "modality": "table",
      "content": {
        "rows": [
          ["City", "Population"],
          ["Tokyo", "13.9M"]
        ]
      }
    }

---

## 5. Conclusion

This RFC extends reasoning to multi‑modal inputs and outputs.
