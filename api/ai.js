export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { query, localTime } = req.body;
  const API_KEY = process.env.AI_API_KEY;


  const prompt = `You are the brain of DOCK, an advanced AI scheduling assistant for a busy sole trader and parent.
  The user's current local time is: ${localTime}.
  
  The user wants to schedule something. Analyze their message and extract the details.
  Message: "${query}"
  
  Return ONLY a raw JSON object wit h no markdown formatting or extra text. Use this exact structure:
  {
    "taskTitle": "Capitalized short clear action",
    "day": "Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday, or Flexible",
    "timeSlot": "Exact time like 8:15 AM, or 'Flexible'",
    "duration": "Estimated time (e.g. 1 hr, 30 mins)",
    "confidence": "High if time/day explicitly stated, Low if guessed",
    "aiMessage": "A short, natural, highly intelligent 1-sentence confirmation asking if they want to schedule this."
  }`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const data = await response.json();
    if (!data.candidates || !data.candidates[0].content) {
      throw new Error("Invalid response from Gemini API");
    }

    let textResult = data.candidates[0].content.parts[0].text;
    textResult = textResult.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const parsedData = JSON.parse(textResult);
    res.status(200).json(parsedData);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to connect to the Google AI brain." });
  }
}
