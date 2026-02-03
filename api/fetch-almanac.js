export default async function handler(req, res) {
  const { date } = req.query;
  
  if (!date || typeof date !== 'string') {
    return res.status(400).json({ error: '缺少日期參數' });
  }
  
  try {
    const url = `https://www.goodaytw.com/${date}`;
    const response = await fetch(url);
    const html = await response.text();
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    
    return res.status(200).send(html);
  } catch (error) {
    return res.status(500).json({ error: '爬取失敗' });
  }
}
