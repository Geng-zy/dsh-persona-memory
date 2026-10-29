#!/usr/bin/env python3
"""Optional local runner. Install torch/diffusers/transformers/accelerate yourself; needs suitable GPU/storage."""
import base64
import contextlib
import io
import json
import sys

request = json.load(sys.stdin)
options = request.get('options', {})
model = request.get('model')
if not model:
    raise ValueError('Set a Diffusers model repository or local model directory')
# Library diagnostics must not corrupt the stdout JSON protocol.
with contextlib.redirect_stdout(sys.stderr):
    import torch
    from diffusers import DiffusionPipeline
    device = options.get('device', 'cuda' if torch.cuda.is_available() else 'cpu')
    dtype = torch.bfloat16 if device == 'cuda' else torch.float32
    pipe = DiffusionPipeline.from_pretrained(model, torch_dtype=dtype).to(device)
    width, height = map(int, request.get('size', options.get('size', '1024x1024')).split('x'))
    kwargs = dict(options.get('generation', {}))
    kwargs.update(prompt=request['prompt'], width=width, height=height, num_images_per_prompt=1)
    if request.get('negativePrompt'):
        kwargs['negative_prompt'] = request['negativePrompt']
    image = pipe(**kwargs).images[0]
    data = io.BytesIO()
    image.save(data, format='PNG')
json.dump({'images': [base64.b64encode(data.getvalue()).decode('ascii')]}, sys.stdout)
