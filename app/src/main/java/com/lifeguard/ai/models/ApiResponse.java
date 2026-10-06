package com.lifeguard.ai.models;

import com.google.gson.annotations.SerializedName;
import java.io.Serializable;
import java.util.List;

public class ApiResponse<T> implements Serializable {
    @SerializedName("success")
    private boolean success;

    @SerializedName("message")
    private String message;

    @SerializedName("token")
    private String token;

    @SerializedName("otpCode")
    private String otpCode;

    @SerializedName("user")
    private User user;

    @SerializedName("contacts")
    private List<Contact> contacts;

    @SerializedName("incomingRequests")
    private List<Contact> incomingRequests;

    @SerializedName("history")
    private List<EmergencyEvent> history;

    @SerializedName("event")
    private EmergencyEvent event;

    @SerializedName("emergencyId")
    private Integer emergencyId;

    @SerializedName("status")
    private String status;

    @SerializedName("contactsNotified")
    private Integer contactsNotified;

    public boolean isSuccess() { return success; }
    public String getMessage() { return message; }
    public String getToken() { return token; }
    public String getOtpCode() { return otpCode; }
    public User getUser() { return user; }
    public List<Contact> getContacts() { return contacts; }
    public List<Contact> getIncomingRequests() { return incomingRequests; }
    public List<EmergencyEvent> getHistory() { return history; }
    public EmergencyEvent getEvent() { return event; }
    public Integer getEmergencyId() { return emergencyId; }
    public String getStatus() { return status; }
    public Integer getContactsNotified() { return contactsNotified; }
}
