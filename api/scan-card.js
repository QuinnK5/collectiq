// Vercel Serverless Function for Smart Card Scanner
// This proxies requests to the Claude API securely

export default async function handler(req, res) {
  // Enable CORS for your frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed. Use POST.' 
    });
  }

  try {
    const { image, mimeType } = req.body;

    // Validate input
    if (!image || !mimeType) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing image or mimeType in request body' 
      });
    }

    console.log('Scanning card image...');

    // Call Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: image
              }
            },
            {
              type: 'text',
              text: `Analyze this graded sports card image and extract the following information. Respond ONLY with a JSON object, no other text or markdown:

{
  "year": "YYYY",
  "manufacturer": "company name (e.g., PANINI, TOPPS, UPPER DECK)",
  "set": "set name (e.g., SELECT, PRIZM, CHROME, MUSEUM COLLECTION)",
  "playerFirstName": "player's first name",
  "playerLastName": "player's last name",
  "variant": "card variant/parallel (e.g., TIE-DYE, SILVER PRIZM, BASE, RELIC-GOLD)",
  "cardNumber": "card number from the label (e.g., #SS-MR, #123)",
  "grade": "numeric grade only (e.g., 9, 10, 9.5)",
  "gradingCompany": "PSA, BGS, CGC, or SGC",
  "certNumber": "certification number",
  "isRookie": true or false,
  "isAutograph": true or false,
  "sport": "Basketball, Soccer, Baseball, Football, or Hockey"
}

Look carefully at the grading label at the top of the card for: year, manufacturer, set name, player name, variant, card number, grade, and certification number.
If any field cannot be determined, use null.`
            }
          ]
        }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API error:', errorText);
      throw new Error(`Claude API request failed: ${response.status}`);
    }

    const data = await response.json();
    console.log('Claude API response received');

    // Extract text content from Claude's response
    const textContent = data.content.find(c => c.type === 'text')?.text || '';
    
    if (!textContent) {
      throw new Error('No text content in Claude response');
    }

    // Parse JSON from response (remove markdown if present)
    const cleanText = textContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    let cardData;
    try {
      cardData = JSON.parse(cleanText);
    } catch (parseError) {
      console.error('Failed to parse JSON:', cleanText);
      throw new Error('Could not parse card data from AI response');
    }

    console.log('Card data extracted successfully');

    // Return success response
    return res.status(200).json({ 
      success: true, 
      data: cardData 
    });

  } catch (error) {
    console.error('Scan error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to scan card'
    });
  }
}
