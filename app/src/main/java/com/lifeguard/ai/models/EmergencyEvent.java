package com.lifeguard.ai.models;

import com.google.gson.annotations.SerializedName;
import java.io.Serializable;

public class EmergencyEvent implements Serializable {
    @SerializedName("id")
    private int id;

    @SerializedName("user_id")
    private int userId;

    @SerializedName("user_name")
    private String userName;

    @SerializedName("user_mobile")
    private String userMobile;

    @SerializedName("detection_type")
    private String detectionType;

    @SerializedName("sound_level")
    private Integer soundLevel;

    @SerializedName("sound_type")
    private String soundType;

    @SerializedName("sound_subtype")
    private String soundSubtype;

    @SerializedName("ai_confidence")
    private Float aiConfidence;

    @SerializedName("possible_emergency")
    private boolean possibleEmergency;

    @SerializedName("ai_reason")
    private String aiReason;

    @SerializedName("user_response")
    private String userResponse;

    @SerializedName("emergency_status")
    private String emergencyStatus;

    @SerializedName("latitude")
    private Double latitude;

    @SerializedName("longitude")
    private Double longitude;

    @SerializedName("location_address")
    private String locationAddress;

    @SerializedName("contacts_notified_count")
    private int contactsNotifiedCount;

    @SerializedName("created_at")
    private String createdAt;

    public EmergencyEvent() {}

    public int getId() { return id; }
    public void setId(int id) { this.id = id; }

    public int getUserId() { return userId; }
    public void setUserId(int userId) { this.userId = userId; }

    public String getUserName() { return userName; }
    public void setUserName(String userName) { this.userName = userName; }

    public String getUserMobile() { return userMobile; }
    public void setUserMobile(String userMobile) { this.userMobile = userMobile; }

    public String getDetectionType() { return detectionType; }
    public void setDetectionType(String detectionType) { this.detectionType = detectionType; }

    public Integer getSoundLevel() { return soundLevel; }
    public void setSoundLevel(Integer soundLevel) { this.soundLevel = soundLevel; }

    public String getSoundType() { return soundType; }
    public void setSoundType(String soundType) { this.soundType = soundType; }

    public String getSoundSubtype() { return soundSubtype; }
    public void setSoundSubtype(String soundSubtype) { this.soundSubtype = soundSubtype; }

    public Float getAiConfidence() { return aiConfidence; }
    public void setAiConfidence(Float aiConfidence) { this.aiConfidence = aiConfidence; }

    public boolean isPossibleEmergency() { return possibleEmergency; }
    public void setPossibleEmergency(boolean possibleEmergency) { this.possibleEmergency = possibleEmergency; }

    public String getAiReason() { return aiReason; }
    public void setAiReason(String aiReason) { this.aiReason = aiReason; }

    public String getUserResponse() { return userResponse; }
    public void setUserResponse(String userResponse) { this.userResponse = userResponse; }

    public String getEmergencyStatus() { return emergencyStatus; }
    public void setEmergencyStatus(String emergencyStatus) { this.emergencyStatus = emergencyStatus; }

    public Double getLatitude() { return latitude; }
    public void setLatitude(Double latitude) { this.latitude = latitude; }

    public Double getLongitude() { return longitude; }
    public void setLongitude(Double longitude) { this.longitude = longitude; }

    public String getLocationAddress() { return locationAddress; }
    public void setLocationAddress(String locationAddress) { this.locationAddress = locationAddress; }

    public int getContactsNotifiedCount() { return contactsNotifiedCount; }
    public void setContactsNotifiedCount(int contactsNotifiedCount) { this.contactsNotifiedCount = contactsNotifiedCount; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
}
