package com.lifeguard.ai.models;

import com.google.gson.annotations.SerializedName;
import java.io.Serializable;

public class SoundAnalysisResult implements Serializable {
    @SerializedName("success")
    private boolean success;

    @SerializedName("sound_type")
    private String soundType; // 'human', 'environmental'

    @SerializedName("sound_subtype")
    private String soundSubtype; // 'distress_like', 'scream', 'crying', 'traffic', etc.

    @SerializedName("confidence")
    private float confidence;

    @SerializedName("possible_emergency")
    private boolean possibleEmergency;

    @SerializedName("reason")
    private String reason;

    @SerializedName("message")
    private String message;

    @SerializedName("error")
    private String error;

    public SoundAnalysisResult() {}

    public boolean isSuccess() { return success; }
    public void setSuccess(boolean success) { this.success = success; }

    public String getSoundType() { return soundType; }
    public void setSoundType(String soundType) { this.soundType = soundType; }

    public String getSoundSubtype() { return soundSubtype; }
    public void setSoundSubtype(String soundSubtype) { this.soundSubtype = soundSubtype; }

    public float getConfidence() { return confidence; }
    public void setConfidence(float confidence) { this.confidence = confidence; }

    public boolean isPossibleEmergency() { return possibleEmergency; }
    public void setPossibleEmergency(boolean possibleEmergency) { this.possibleEmergency = possibleEmergency; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public String getError() { return error; }
    public void setError(String error) { this.error = error; }
}
