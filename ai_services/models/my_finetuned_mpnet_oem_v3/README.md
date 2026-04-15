---
tags:
- sentence-transformers
- sentence-similarity
- feature-extraction
- dense
- generated_from_trainer
- dataset_size:789
- loss:CosineSimilarityLoss
base_model: sentence-transformers/paraphrase-multilingual-mpnet-base-v2
widget:
- source_sentence: Tìm các chuỗi bắt đầu bằng chữ 'a'.
  sentences:
  - DNS dịch từ địa chỉ IP dạng số sang tên miền dạng văn bản để máy tính hiểu.
  - Lạm phát phi mã là hiện tượng khi chính phủ thành công trong việc kiểm soát lạm
    phát, giữ cho giá cả ở mức ổn định và có thể dự đoán được, tạo ra một môi trường
    kinh tế vững chắc và khuyến khích tiết kiệm, đầu tư dài hạn.
  - Sử dụng LIKE '%a' để tìm các chuỗi có chứa ký tự 'a' ở bất kỳ vị trí nào trong
    chuỗi.
- source_sentence: Giai cấp là những tập đoàn người có địa vị khác nhau trong một
    hệ thống sản xuất xã hội nhất định.
  sentences:
  - Tình trạng bế tắc xảy ra khi hai hoặc nhiều tiến trình cùng chờ đợi một tài nguyên
    mà tiến trình kia đang chuẩn bị giải phóng.
  - Nếu một cái PC mà đứt cáp thì tụi máy râu ria khác vẫn xài phà phà qua cái cục
    hub ở giữa.
  - Hệ thống sản xuất xã hội quyết định địa vị của các tập đoàn người khác nhau gọi
    là giai cấp.
- source_sentence: Phụ thuộc vào thu nhập và lãi suất, trong đó lãi suất là chi phí
    cơ hội của việc giữ tiền.
  sentences:
  - LAN là viết tắt của Local Area Network, chỉ một mạng máy tính quy mô nhỏ, được
    sử dụng để liên kết các thiết bị trong cùng một vị trí địa lý cụ thể như một chi
    nhánh công ty hoặc một tầng của tòa nhà, phục vụ mục đích truyền tải dữ liệu nội
    bộ.
  - Cầu tiền dựa trên thu nhập và lãi suất, giữ tiền mặt ở nhà sinh ra rất nhiều lợi
    nhuận nếu tính thêm lạm phát.
  - Tổ chứt zà nưu chữ dử lịu trên thiết bị nhó để ngừi dùng có thể dể giàng tỳm кіếm
    và chuy xứt.
- source_sentence: Hàm số khả vi tại một điểm thì không thể không liên tục tại điểm
    đó.
  sentences:
  - Chắc chắn là có ạ. Một hàm số được gọi là khả vi tại một điểm thì luôn luôn liên
    tục tại điểm đó. Tính khả vi là một điều kiện chặt chẽ hơn, nó đòi hỏi hàm số
    phải 'mịn' và không bị đứt gãy hay có góc nhọn tại điểm đó, điều này đương nhiên
    bao hàm cả tính liên tục.
  - Biến static là biến mà tất cả các đối tượng của một lớp có thể dùng chung một
    giá trị. Nếu một đối tượng thay đổi, thì đối tượng khác cũng thấy sự thay đổi
    đó. Nó giúp tiết kiệm bộ nhớ khi không cần tạo nhiều biến.
  - Hình học dùng tích phân xác định để giới hạn diện tích các đường cong phẳng.
- source_sentence: Là văn bản do cơ quan nhà nước có thẩm quyền ban hành theo trình
    tự luật định.
  sentences:
  - Tít pân xát dịnh thừơng được úng dọng đễ týnh dịên tít hìn fẳng dới hạn bỏi cáy
    đườn cog.
  - Đặc điểm của văn bản quy phạm pháp luật là trình tự luật định ban hành cơ quan
    nhà nước có thẩm quyền.
  - Cái xờ-uýt nó chạy ở cái lớp liên kết dữ liệu số 2 và nhìn vào cái mác-át-rết
    để đá mấy cái cút xê đi tiếp.
pipeline_tag: sentence-similarity
library_name: sentence-transformers
---

# SentenceTransformer based on sentence-transformers/paraphrase-multilingual-mpnet-base-v2

This is a [sentence-transformers](https://www.SBERT.net) model finetuned from [sentence-transformers/paraphrase-multilingual-mpnet-base-v2](https://huggingface.co/sentence-transformers/paraphrase-multilingual-mpnet-base-v2). It maps sentences & paragraphs to a 768-dimensional dense vector space and can be used for semantic textual similarity, semantic search, paraphrase mining, text classification, clustering, and more.

## Model Details

### Model Description
- **Model Type:** Sentence Transformer
- **Base model:** [sentence-transformers/paraphrase-multilingual-mpnet-base-v2](https://huggingface.co/sentence-transformers/paraphrase-multilingual-mpnet-base-v2) <!-- at revision 4328cf26390c98c5e3c738b4460a05b95f4911f5 -->
- **Maximum Sequence Length:** 128 tokens
- **Output Dimensionality:** 768 dimensions
- **Similarity Function:** Cosine Similarity
<!-- - **Training Dataset:** Unknown -->
<!-- - **Language:** Unknown -->
<!-- - **License:** Unknown -->

### Model Sources

- **Documentation:** [Sentence Transformers Documentation](https://sbert.net)
- **Repository:** [Sentence Transformers on GitHub](https://github.com/huggingface/sentence-transformers)
- **Hugging Face:** [Sentence Transformers on Hugging Face](https://huggingface.co/models?library=sentence-transformers)

### Full Model Architecture

```
SentenceTransformer(
  (0): Transformer({'max_seq_length': 128, 'do_lower_case': False, 'architecture': 'XLMRobertaModel'})
  (1): Pooling({'word_embedding_dimension': 768, 'pooling_mode_cls_token': False, 'pooling_mode_mean_tokens': True, 'pooling_mode_max_tokens': False, 'pooling_mode_mean_sqrt_len_tokens': False, 'pooling_mode_weightedmean_tokens': False, 'pooling_mode_lasttoken': False, 'include_prompt': True})
)
```

## Usage

### Direct Usage (Sentence Transformers)

First install the Sentence Transformers library:

```bash
pip install -U sentence-transformers
```

Then you can load this model and run inference.
```python
from sentence_transformers import SentenceTransformer

# Download from the 🤗 Hub
model = SentenceTransformer("sentence_transformers_model_id")
# Run inference
sentences = [
    'Là văn bản do cơ quan nhà nước có thẩm quyền ban hành theo trình tự luật định.',
    'Đặc điểm của văn bản quy phạm pháp luật là trình tự luật định ban hành cơ quan nhà nước có thẩm quyền.',
    'Cái xờ-uýt nó chạy ở cái lớp liên kết dữ liệu số 2 và nhìn vào cái mác-át-rết để đá mấy cái cút xê đi tiếp.',
]
embeddings = model.encode(sentences)
print(embeddings.shape)
# [3, 768]

# Get the similarity scores for the embeddings
similarities = model.similarity(embeddings, embeddings)
print(similarities)
# tensor([[1.0000, 0.0376, 0.4240],
#         [0.0376, 1.0000, 0.1498],
#         [0.4240, 0.1498, 1.0000]])
```

<!--
### Direct Usage (Transformers)

<details><summary>Click to see the direct usage in Transformers</summary>

</details>
-->

<!--
### Downstream Usage (Sentence Transformers)

You can finetune this model on your own dataset.

<details><summary>Click to expand</summary>

</details>
-->

<!--
### Out-of-Scope Use

*List how the model may foreseeably be misused and address what users ought not to do with the model.*
-->

<!--
## Bias, Risks and Limitations

*What are the known or foreseeable issues stemming from this model? You could also flag here known failure cases or weaknesses of the model.*
-->

<!--
### Recommendations

*What are recommendations with respect to the foreseeable issues? For example, filtering explicit content.*
-->

## Training Details

### Training Dataset

#### Unnamed Dataset

* Size: 789 training samples
* Columns: <code>sentence_0</code>, <code>sentence_1</code>, and <code>label</code>
* Approximate statistics based on the first 789 samples:
  |         | sentence_0                                                                        | sentence_1                                                                         | label                                                          |
  |:--------|:----------------------------------------------------------------------------------|:-----------------------------------------------------------------------------------|:---------------------------------------------------------------|
  | type    | string                                                                            | string                                                                             | float                                                          |
  | details | <ul><li>min: 3 tokens</li><li>mean: 22.72 tokens</li><li>max: 60 tokens</li></ul> | <ul><li>min: 4 tokens</li><li>mean: 36.75 tokens</li><li>max: 128 tokens</li></ul> | <ul><li>min: 0.0</li><li>mean: 0.49</li><li>max: 1.0</li></ul> |
* Samples:
  | sentence_0                                                                                                                       | sentence_1                                                                                                                                                                            | label            |
  |:---------------------------------------------------------------------------------------------------------------------------------|:--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|:-----------------|
  | <code>Là động lực phát triển của xã hội có giai cấp.</code>                                                                      | <code>Là nguyên nhân chính thúc đẩy sự đi lên của các xã hội có sự phân chia tầng lớp bất bình đẳng.</code>                                                                           | <code>1.0</code> |
  | <code>Nếu hàm số liên tục trên đoạn [a,b] và f(a)=f(b) thì tồn tại ít nhất một điểm c thuộc khoảng (a,b) sao cho f'(c)=0.</code> | <code>Định lý Rolle là khi một hàm số có f'(c)=0 ở đâu đó thì nó sẽ liên tục trên [a,b] và f(a)=f(b). Điều này rất quan trọng để xác định các điểm đặc biệt của đồ thị hàm số.</code> | <code>0.0</code> |
  | <code>Ti thể là nơi diễn ra quá trình hô hấp tế bào để tạo ra năng lượng ATP.</code>                                             | <code>Ti thể là xưởng năng lượng của tế bào, nơi giải phóng năng lượng từ thức ăn.</code>                                                                                             | <code>1.0</code> |
* Loss: [<code>CosineSimilarityLoss</code>](https://sbert.net/docs/package_reference/sentence_transformer/losses.html#cosinesimilarityloss) with these parameters:
  ```json
  {
      "loss_fct": "torch.nn.modules.loss.MSELoss"
  }
  ```

### Training Hyperparameters
#### Non-Default Hyperparameters

- `per_device_train_batch_size`: 16
- `per_device_eval_batch_size`: 16
- `multi_dataset_batch_sampler`: round_robin

#### All Hyperparameters
<details><summary>Click to expand</summary>

- `do_predict`: False
- `eval_strategy`: no
- `prediction_loss_only`: True
- `per_device_train_batch_size`: 16
- `per_device_eval_batch_size`: 16
- `gradient_accumulation_steps`: 1
- `eval_accumulation_steps`: None
- `torch_empty_cache_steps`: None
- `learning_rate`: 5e-05
- `weight_decay`: 0.0
- `adam_beta1`: 0.9
- `adam_beta2`: 0.999
- `adam_epsilon`: 1e-08
- `max_grad_norm`: 1
- `num_train_epochs`: 3
- `max_steps`: -1
- `lr_scheduler_type`: linear
- `lr_scheduler_kwargs`: None
- `warmup_ratio`: None
- `warmup_steps`: 0
- `log_level`: passive
- `log_level_replica`: warning
- `log_on_each_node`: True
- `logging_nan_inf_filter`: True
- `enable_jit_checkpoint`: False
- `save_on_each_node`: False
- `save_only_model`: False
- `restore_callback_states_from_checkpoint`: False
- `use_cpu`: False
- `seed`: 42
- `data_seed`: None
- `bf16`: False
- `fp16`: False
- `bf16_full_eval`: False
- `fp16_full_eval`: False
- `tf32`: None
- `local_rank`: -1
- `ddp_backend`: None
- `debug`: []
- `dataloader_drop_last`: False
- `dataloader_num_workers`: 0
- `dataloader_prefetch_factor`: None
- `disable_tqdm`: False
- `remove_unused_columns`: True
- `label_names`: None
- `load_best_model_at_end`: False
- `ignore_data_skip`: False
- `fsdp`: []
- `fsdp_config`: {'min_num_params': 0, 'xla': False, 'xla_fsdp_v2': False, 'xla_fsdp_grad_ckpt': False}
- `accelerator_config`: {'split_batches': False, 'dispatch_batches': None, 'even_batches': True, 'use_seedable_sampler': True, 'non_blocking': False, 'gradient_accumulation_kwargs': None}
- `parallelism_config`: None
- `deepspeed`: None
- `label_smoothing_factor`: 0.0
- `optim`: adamw_torch_fused
- `optim_args`: None
- `group_by_length`: False
- `length_column_name`: length
- `project`: huggingface
- `trackio_space_id`: trackio
- `ddp_find_unused_parameters`: None
- `ddp_bucket_cap_mb`: None
- `ddp_broadcast_buffers`: False
- `dataloader_pin_memory`: True
- `dataloader_persistent_workers`: False
- `skip_memory_metrics`: True
- `push_to_hub`: False
- `resume_from_checkpoint`: None
- `hub_model_id`: None
- `hub_strategy`: every_save
- `hub_private_repo`: None
- `hub_always_push`: False
- `hub_revision`: None
- `gradient_checkpointing`: False
- `gradient_checkpointing_kwargs`: None
- `include_for_metrics`: []
- `eval_do_concat_batches`: True
- `auto_find_batch_size`: False
- `full_determinism`: False
- `ddp_timeout`: 1800
- `torch_compile`: False
- `torch_compile_backend`: None
- `torch_compile_mode`: None
- `include_num_input_tokens_seen`: no
- `neftune_noise_alpha`: None
- `optim_target_modules`: None
- `batch_eval_metrics`: False
- `eval_on_start`: False
- `use_liger_kernel`: False
- `liger_kernel_config`: None
- `eval_use_gather_object`: False
- `average_tokens_across_devices`: True
- `use_cache`: False
- `prompts`: None
- `batch_sampler`: batch_sampler
- `multi_dataset_batch_sampler`: round_robin
- `router_mapping`: {}
- `learning_rate_mapping`: {}

</details>

### Framework Versions
- Python: 3.12.13
- Sentence Transformers: 5.3.0
- Transformers: 5.0.0
- PyTorch: 2.10.0+cu128
- Accelerate: 1.13.0
- Datasets: 4.0.0
- Tokenizers: 0.22.2

## Citation

### BibTeX

#### Sentence Transformers
```bibtex
@inproceedings{reimers-2019-sentence-bert,
    title = "Sentence-BERT: Sentence Embeddings using Siamese BERT-Networks",
    author = "Reimers, Nils and Gurevych, Iryna",
    booktitle = "Proceedings of the 2019 Conference on Empirical Methods in Natural Language Processing",
    month = "11",
    year = "2019",
    publisher = "Association for Computational Linguistics",
    url = "https://arxiv.org/abs/1908.10084",
}
```

<!--
## Glossary

*Clearly define terms in order to be accessible across audiences.*
-->

<!--
## Model Card Authors

*Lists the people who create the model card, providing recognition and accountability for the detailed work that goes into its construction.*
-->

<!--
## Model Card Contact

*Provides a way for people who have updates to the Model Card, suggestions, or questions, to contact the Model Card authors.*
-->