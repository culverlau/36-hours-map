/**
 * LLM fallback for disambiguating locations
 * Only called when geocoding returns ambiguous results
 */

/**
 * Use LLM to disambiguate between multiple geocoding results
 * @param {object} article - Article with title, abstract, glocations
 * @param {array} geocodeOptions - Array of possible locations from geocoder
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<{selected: object, confidence: string, reasoning: string}>}
 */
export async function disambiguateLocation(article, geocodeOptions, apiKey) {
  const prompt = `You are helping to determine the correct location for a New York Times "36 Hours" travel article.

Article title: ${article.title}
Article abstract: ${article.abstract}
Location keywords from NYT: ${article.glocations.join(', ') || 'none'}

The geocoding service returned multiple possible locations:
${geocodeOptions.map((opt, i) => `${i + 1}. ${opt.formattedAddress} (lat: ${opt.lat}, lng: ${opt.lng})`).join('\n')}

Based on the article information, which location is correct? Respond with JSON only:
{
  "selectedIndex": <number 1-${geocodeOptions.length}>,
  "confidence": "high" | "medium" | "low",
  "reasoning": "<brief explanation>"
}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      max_tokens: 200,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  try {
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const result = JSON.parse(jsonMatch[0]);
    const selectedOption = geocodeOptions[result.selectedIndex - 1];

    return {
      selected: selectedOption,
      confidence: result.confidence,
      reasoning: result.reasoning,
    };
  } catch (e) {
    console.error('Failed to parse LLM response:', content);
    return {
      selected: null,
      confidence: 'low',
      reasoning: 'Failed to parse LLM response',
    };
  }
}

/**
 * Use LLM to geocode a location that the geocoder couldn't find
 * @param {object} article - Article with title, abstract, glocations
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<{lat: number, lng: number, name: string, confidence: string}>}
 */
export async function llmGeocode(article, apiKey) {
  const prompt = `You are helping to determine the coordinates for a New York Times "36 Hours" travel article location.

Article title: ${article.title}
Article abstract: ${article.abstract}
Location extracted from title: ${article.locationFromTitle}
Location keywords from NYT: ${article.glocations.join(', ') || 'none'}

The standard geocoding service could not find this location. Please provide your best estimate of the coordinates.

Respond with JSON only:
{
  "lat": <latitude as number>,
  "lng": <longitude as number>,
  "name": "<canonical name for this location>",
  "confidence": "high" | "medium" | "low",
  "reasoning": "<brief explanation>"
}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      max_tokens: 200,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error('Failed to parse LLM response:', content);
    return null;
  }
}
