package com.lifeguard.ai.models;

import com.google.gson.annotations.SerializedName;
import java.io.Serializable;

public class Contact implements Serializable {
    @SerializedName("id")
    private int id;

    @SerializedName("user_id")
    private int userId;

    @SerializedName("contact_user_id")
    private Integer contactUserId;

    @SerializedName("contact_name")
    private String contactName;

    @SerializedName("contact_mobile")
    private String contactMobile;

    @SerializedName("status")
    private String status; // 'pending', 'accepted', 'connected'

    @SerializedName("is_emergency_recipient")
    private boolean isEmergencyRecipient;

    @SerializedName("created_at")
    private String createdAt;

    public Contact() {}

    public int getId() { return id; }
    public void setId(int id) { this.id = id; }

    public int getUserId() { return userId; }
    public void setUserId(int userId) { this.userId = userId; }

    public Integer getContactUserId() { return contactUserId; }
    public void setContactUserId(Integer contactUserId) { this.contactUserId = contactUserId; }

    public String getContactName() { return contactName; }
    public void setContactName(String contactName) { this.contactName = contactName; }

    public String getContactMobile() { return contactMobile; }
    public void setContactMobile(String contactMobile) { this.contactMobile = contactMobile; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public boolean isEmergencyRecipient() { return isEmergencyRecipient; }
    public void setEmergencyRecipient(boolean emergencyRecipient) { isEmergencyRecipient = emergencyRecipient; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
}
