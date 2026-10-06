const { analyzeAudioWithGemini } = require('../config/gemini');

/**
 * Analyze Audio Sample using Gemini API
 * POST /api/analyze-sound
 * Accepts multipart/form-data with field 'audio' OR json with 'audio_base64'
 */
async function analyzeSound(req, res) {
  try {
    let audioBuffer = null;
    let mimeType = 'audio/mp4';

    if (req.file) {
      audioBuffer = req.file.buffer;
      mimeType = req.file.mimetype || 'audio/mp4';
    } else if (req.body && req.body.audio_base64) {
      audioBuffer = Buffer.from(req.body.audio_base64, 'base64');
      if (req.body.mime_type) {
        mimeType = req.body.mime_type;
      }
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No audio sample received. Please provide an audio file or base64 stream.'
      });
    }

    console.log(`[AI Analysis] Processing short audio sample (${audioBuffer.length} bytes, format: ${mimeType}) via Gemini API...`);

    // Call Gemini API
    const result = await analyzeAudioWithGemini(audioBuffer, mimeType);

    if (!result.success) {
      // Truthful error reporting per prompt rule: "AI analysis unavailable"
      return res.status(503).json({
        success: false,
        message: result.error || 'AI analysis unavailable.',
        error: result.error || 'AI analysis unavailable.'
      });
    }

    const aiData = result.data;

    return res.json({
      success: true,
      sound_type: aiData.sound_type || 'unknown',
      sound_subtype: aiData.sound_subtype || 'unknown',
      confidence: typeof aiData.confidence === 'number' ? aiData.confidence : 0.8,
      possible_emergency: Boolean(aiData.possible_emergency),
      reason: aiData.reason || 'Audio analysis completed.'
    });

  } catch (error) {
    console.error('[AI Analysis Controller Error]', error);
    return res.status(500).json({
      success: false,
      message: 'AI analysis unavailable.',
      error: 'AI analysis unavailable.'
    });
  }
}

module.exports = {
  analyzeSound
};
