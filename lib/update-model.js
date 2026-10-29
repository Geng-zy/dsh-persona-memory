function endpoint(api, path) {
    if (!api.url.trim())
        throw new Error('请先填写报告模型的API地址');
    const url = new URL(api.url.trim().replace(/\/+$/, '') + path);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash)
        throw new Error('API地址应为不含密钥或查询参数的HTTP(S)基础地址');
    return url.toString();
}
function headers(api) {
    return { 'content-type': 'application/json', ...(api.protocol === 'anthropic' ? { 'anthropic-version': '2023-06-01', ...(api.key ? { 'x-api-key': api.key } : {}) } : api.key ? { authorization: 'Bearer ' + api.key } : {}) };
}
export async function reportApiModels(api, signal, doFetch = fetch) {
    const res = await doFetch(endpoint(api, '/models'), { headers: headers(api), signal, redirect: 'error' });
    if (!res.ok)
        throw new Error('获取模型列表失败（HTTP ' + res.status + '）；可直接填写模型名称');
    const data = await res.json();
    const models = [...new Set((data.data ?? data.models ?? []).map((m) => String(m.id ?? m.name ?? '')).filter(Boolean))].sort();
    if (!models.length)
        throw new Error('接口没有返回模型列表，请直接填写模型名称');
    return models;
}
export async function reportApiComplete(api, prompt, maxTokens, signal, doFetch = fetch) {
    if (!api.model.trim())
        throw new Error('请选择或填写报告模型名称');
    const anthropic = api.protocol === 'anthropic';
    const res = await doFetch(endpoint(api, anthropic ? '/messages' : '/chat/completions'), {
        method: 'POST', headers: headers(api), signal, redirect: 'error',
        body: JSON.stringify({ model: api.model.trim(), max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }], stream: false }),
    });
    if (!res.ok)
        throw new Error('报告模型接口返回HTTP ' + res.status + '，请核对API地址、密钥和模型名称');
    const data = await res.json();
    const finish = anthropic ? data.stop_reason : data.choices?.[0]?.finish_reason;
    if (finish !== (anthropic ? 'end_turn' : 'stop'))
        throw new Error('模型未完整结束或输出被截断，请检查输出预算及模型支持情况');
    const content = anthropic ? data.content : data.choices?.[0]?.message?.content;
    const text = typeof content === 'string' ? content : Array.isArray(content) ? content.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('') : '';
    if (!text.trim())
        throw new Error('报告模型没有返回正文');
    return text;
}
