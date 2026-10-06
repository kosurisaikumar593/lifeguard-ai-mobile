const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config();

/**
 * Gemini AI Audio Analysis Service for LifeGuard AI
 * Strictly follows safety specifications:
 * 1. Analyzes audio samples using official Gemini API.
 * 2. Distinguishes between Human and Environmental sounds.
 * 3. If Human, detects whether it's normal or distress-like (scream, crying, help-like).
 * 4. NEVER performs speaker verification or owner vs stranger identification.
 * 5. Structured JSON output matching required schema.
 * 6. Clean error handling ("AI analysis unavailable").
 */

async function analyzeAudioWithGemini(audioBufferOrPath, mimeType = 'audio/mp4') {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY' || apiKey.trim() === '') {
    console.warn('[Gemini AI] GEMINI_API_KEY is not configured in .env');
    return {
      success: false,
      error: 'AI analysis unavailable. Gemini API key is not configured on the backend server.'
    };
  }

  try {
    // Read audio buffer
    let audioBuffer;
    if (typeof audioBufferOrPath === 'string') {
      audioBuffer = fs.readFileSync(audioBufferOrPath);
    } else {
      audioBuffer = audioBufferOrPath;
    }

    const base64Audio = audioBuffer.toString('base64');

    const promptText = `
You are an expert audio acoustic analysis engine integrated into the LifeGuard AI personal safety system.
Analyze this short audio sample captured from the surrounding environment.

CLASSIFICATION RULES:
1. Determine the PRIMARY sound category: "human" or "environmental".
2. Environmental sounds include: "traffic", "construction", "music", "machine", "animal", "alarm", "other".
3. Human sounds include: "distress_like", "scream", "crying", "help_like", "normal_human", "conversation", "laughter".
4. Determine "possible_emergency":
   - true ONLY if human distress-like vocalization, scream, desperate cries for help, or acute distress is heard.
   - false for normal conversation, laughter, singing, or environmental sounds.
5. NEVER identify the speaker or attempt owner identification.
6. The result must represent "possible distress", NOT "danger confirmed".

Respond STRICTLY in valid JSON format matching this exact schema:
{
  "sound_type": "human" | "environmental",
  "sound_subtype": "distress_like" | "scream" | "crying" | "help_like" | "normal_human" | "conversation" | "laughter" | "traffic" | "construction" | "music" | "machine" | "animal" | "alarm" | "other",
  "confidence": 0.85,
  "possible_emergency": true | false,
  "reason": "Brief objective explanation of detected audio characteristics."
}
`;

    // Try @google/genai SDK first
    try {
      const { GoogleGenAI, Type } = require('@google/genai');
      const ai = new GoogleGenAI({ apiKey });

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            inlineData: {
              mimeType: mimeType || 'audio/mp4',
              data: base64Audio
            }
          },
          promptText
        ],
        config: {
          responseMimeType: 'application/json',
          responseJsonSchema: {
            type: Type.OBJECT,
            properties: {
              sound_type: {
                type: Type.STRING,
                description: 'Whether sound is human or environmental'
              },
              sound_subtype: {
                type: Type.STRING,
                description: 'Specific classification e.g. distress_like, scream, crying, conversation, traffic'
              },
              confidence: {
                type: Type.NUMBER,
                description: 'Classification confidence between 0.0 and 1.0'
              },
              possible_emergency: {
                type: Type.BOOLEAN,
                description: 'True if sound indicates a possible emergency or distress'
              },
              reason: {
                type: Type.STRING,
                description: 'Objective explanation of detection'
              }
            },
            propertyOrdering: ['sound_type', 'sound_subtype', 'confidence', 'possible_emergency', 'reason']
          }
        }
      });

      const responseText = response.text || (response.candidates && response.candidates[0]?.content?.parts[0]?.text);
      if (responseText) {
        const parsed = JSON.parse(responseText.trim());
        return {
          success: true,
          data: parsed
        };
      }
    } catch (sdkError) {
      console.warn(`[Gemini SDK attempt] ${sdkError.message}. Attempting REST API fallback...`);
    }

    // Direct Gemini REST API Fallback
    const fetch = global.fetch || ((await import('node-fetch')).default);
    const restUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const requestBody = {
      contents: [
        {
          parts: [
            {
              inline_data: {
                mime_type: mimeType || 'audio/mp4',
                data: base64Audio
              }
            },
            {
              text: promptText
            }
          ]
        }
      ],
      generationConfig: {
        response_mime_type: 'application/json'
      }
    };

    const res = await fetch(restUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[Gemini REST API Error]', res.status, errText);
      return {
        success: false,
        error: `AI analysis unavailable (status ${res.status}).`
      };
    }

    const jsonRes = await res.json();
    const candidateText = jsonRes.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) {
      return {
        success: false,
        error: 'AI analysis unavailable. No response candidates returned.'
      };
    }

    const parsedData = JSON.parse(candidateText.trim());
    return {
      success: true,
      data: parsedData
    };

  } catch (error) {
    console.error('[Gemini Service Failure]', error.message);
    return {
      success: false,
      error: 'AI analysis unavailable.'
    };
  }
}

module.exports = {
  analyzeAudioWithGemini
};
