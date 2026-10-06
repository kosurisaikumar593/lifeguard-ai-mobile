package com.lifeguard.ai.models;

import com.google.gson.annotations.SerializedName;
import java.io.Serializable;

public class User implements Serializable {
    @SerializedName("id")
    private int id;

    @SerializedName("name")
    private String name;

    @SerializedName("mobile")
    private String mobile;

    @SerializedName("fcm_token")
    private String fcmToken;

    @SerializedName("safety_status")
    private String safetyStatus;

    @SerializedName("created_at")
    private String createdAt;

    public User() {}

    public User(int id, String name, String mobile) {
        this.id = id;
        this.name = name;
        this.mobile = mobile;
    }

    public int getId() { return id; }
    public void setId(int id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getMobile() { return mobile; }
    public void setMobile(String mobile) { this.mobile = mobile; }

    public String getFcmToken() { return fcmToken; }
    public void setFcmToken(String fcmToken) { this.fcmToken = fcmToken; }

    public String getSafetyStatus() { return safetyStatus; }
    public void setSafetyStatus(String safetyStatus) { this.safetyStatus = safetyStatus; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
}
