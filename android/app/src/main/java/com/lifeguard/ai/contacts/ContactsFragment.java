package com.lifeguard.ai.contacts;

import android.content.Intent;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;
import com.lifeguard.ai.R;
import com.lifeguard.ai.api.ApiClient;
import com.lifeguard.ai.models.ApiResponse;
import com.lifeguard.ai.models.Contact;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class ContactsFragment extends Fragment {

    private RecyclerView rvContacts, rvPendingRequests;
    private TextView tvEmptyContacts, tvPendingHeader;
    private SwipeRefreshLayout swipeRefreshContacts;
    private Button btnAddContact;

    private ContactAdapter contactAdapter;
    private PendingAdapter pendingAdapter;
    private final List<Contact> contactList = new ArrayList<>();
    private final List<Contact> pendingList = new ArrayList<>();

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_contacts, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        rvContacts = view.findViewById(R.id.rvContacts);
        rvPendingRequests = view.findViewById(R.id.rvPendingRequests);
        tvEmptyContacts = view.findViewById(R.id.tvEmptyContacts);
        tvPendingHeader = view.findViewById(R.id.tvPendingHeader);
        swipeRefreshContacts = view.findViewById(R.id.swipeRefreshContacts);
        btnAddContact = view.findViewById(R.id.btnAddContact);

        rvContacts.setLayoutManager(new LinearLayoutManager(requireContext()));
        contactAdapter = new ContactAdapter(contactList, contact -> {
            Intent intent = new Intent(requireContext(), ContactDetailActivity.class);
            intent.putExtra("contact", contact);
            startActivity(intent);
        });
        rvContacts.setAdapter(contactAdapter);

        rvPendingRequests.setLayoutManager(new LinearLayoutManager(requireContext()));
        pendingAdapter = new PendingAdapter(pendingList, contact -> acceptRequest(contact));
        rvPendingRequests.setAdapter(pendingAdapter);

        btnAddContact.setOnClickListener(v -> {
            startActivity(new Intent(requireContext(), AddContactActivity.class));
        });

        swipeRefreshContacts.setOnRefreshListener(this::loadContacts);

        loadContacts();
    }

    private void loadContacts() {
        swipeRefreshContacts.setRefreshing(true);
        ApiClient.getService(requireContext()).getContacts().enqueue(new Callback<ApiResponse<Void>>() {
            @Override
            public void onResponse(Call<ApiResponse<Void>> call, Response<ApiResponse<Void>> response) {
                swipeRefreshContacts.setRefreshing(false);
                if (response.isSuccessful() && response.body() != null) {
                    ApiResponse<Void> res = response.body();

                    contactList.clear();
                    if (res.getContacts() != null) {
                        contactList.addAll(res.getContacts());
                    }
                    contactAdapter.notifyDataSetChanged();

                    pendingList.clear();
                    if (res.getIncomingRequests() != null && !res.getIncomingRequests().isEmpty()) {
                        pendingList.addAll(res.getIncomingRequests());
                        tvPendingHeader.setVisibility(View.VISIBLE);
                        rvPendingRequests.setVisibility(View.VISIBLE);
                    } else {
                        tvPendingHeader.setVisibility(View.GONE);
                        rvPendingRequests.setVisibility(View.GONE);
                    }
                    pendingAdapter.notifyDataSetChanged();

                    tvEmptyContacts.setVisibility(contactList.isEmpty() ? View.VISIBLE : View.GONE);
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<Void>> call, Throwable t) {
                swipeRefreshContacts.setRefreshing(false);
                Toast.makeText(requireContext(), "Failed to load contacts.", Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void acceptRequest(Contact contact) {
        Map<String, Object> body = new HashMap<>();
        body.put("contactId", contact.getId());

        ApiClient.getService(requireContext()).acceptContact(body).enqueue(new Callback<ApiResponse<Void>>() {
            @Override
            public void onResponse(Call<ApiResponse<Void>> call, Response<ApiResponse<Void>> response) {
                Toast.makeText(requireContext(), "Contact accepted! You are now connected.", Toast.LENGTH_SHORT).show();
                loadContacts();
            }
            @Override
            public void onFailure(Call<ApiResponse<Void>> call, Throwable t) {
                Toast.makeText(requireContext(), "Failed to accept contact.", Toast.LENGTH_SHORT).show();
            }
        });
    }

    @Override
    public void onResume() {
        super.onResume();
        loadContacts();
    }

    // RecyclerView Adapters
    private interface OnContactClickListener {
        void onContactClick(Contact contact);
    }

    private static class ContactAdapter extends RecyclerView.Adapter<ContactAdapter.Holder> {
        private final List<Contact> list;
        private final OnContactClickListener listener;

        public ContactAdapter(List<Contact> list, OnContactClickListener listener) {
            this.list = list;
            this.listener = listener;
        }

        @NonNull
        @Override
        public Holder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
            View v = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_contact, parent, false);
            return new Holder(v);
        }

        @Override
        public void onBindViewHolder(@NonNull Holder holder, int position) {
            Contact c = list.get(position);
            holder.tvContactName.setText(c.getContactName());
            holder.tvContactMobile.setText(c.getContactMobile());
            holder.tvContactStatusBadge.setText(c.getStatus() != null ? c.getStatus().toUpperCase() : "CONNECTED");

            String initials = "C";
            if (c.getContactName() != null && !c.getContactName().isEmpty()) {
                String[] parts = c.getContactName().split(" ");
                if (parts.length > 1) {
                    initials = ("" + parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
                } else {
                    initials = ("" + c.getContactName().charAt(0)).toUpperCase();
                }
            }
            holder.tvAvatarInitials.setText(initials);

            holder.itemView.setOnClickListener(v -> {
                if (listener != null) listener.onContactClick(c);
            });
        }

        @Override
        public int getItemCount() { return list.size(); }

        static class Holder extends RecyclerView.ViewHolder {
            TextView tvAvatarInitials, tvContactName, tvContactMobile, tvContactStatusBadge;
            public Holder(@NonNull View itemView) {
                super(itemView);
                tvAvatarInitials = itemView.findViewById(R.id.tvAvatarInitials);
                tvContactName = itemView.findViewById(R.id.tvContactName);
                tvContactMobile = itemView.findViewById(R.id.tvContactMobile);
                tvContactStatusBadge = itemView.findViewById(R.id.tvContactStatusBadge);
            }
        }
    }

    private static class PendingAdapter extends RecyclerView.Adapter<PendingAdapter.Holder> {
        private final List<Contact> list;
        private final OnContactClickListener listener;

        public PendingAdapter(List<Contact> list, OnContactClickListener listener) {
            this.list = list;
            this.listener = listener;
        }

        @NonNull
        @Override
        public Holder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
            View v = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_pending_request, parent, false);
            return new Holder(v);
        }

        @Override
        public void onBindViewHolder(@NonNull Holder holder, int position) {
            Contact c = list.get(position);
            holder.tvRequesterName.setText(c.getContactName() != null ? c.getContactName() : "Safety Contact");
            holder.tvRequesterMobile.setText(c.getContactMobile());
            holder.btnAcceptRequest.setOnClickListener(v -> {
                if (listener != null) listener.onContactClick(c);
            });
        }

        @Override
        public int getItemCount() { return list.size(); }

        static class Holder extends RecyclerView.ViewHolder {
            TextView tvRequesterName, tvRequesterMobile;
            Button btnAcceptRequest;
            public Holder(@NonNull View itemView) {
                super(itemView);
                tvRequesterName = itemView.findViewById(R.id.tvRequesterName);
                tvRequesterMobile = itemView.findViewById(R.id.tvRequesterMobile);
                btnAcceptRequest = itemView.findViewById(R.id.btnAcceptRequest);
            }
        }
    }
}
