import SwiftUI

struct CommunityView: View {
    @State private var items: [CommunityItem] = []
    @State private var pendingItems: [CommunityItem] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showingSubmitSheet = false
    @State private var selectedTab = 0

    @ObservedObject var authService: AuthService

    private let columns = [
        GridItem(.flexible(), spacing: 16),
        GridItem(.flexible(), spacing: 16)
    ]

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if authService.isAdmin {
                    Picker("View", selection: $selectedTab) {
                        Text("Approved").tag(0)
                        Text("Pending (\(pendingItems.count))").tag(1)
                    }
                    .pickerStyle(.segmented)
                    .padding()
                }

                if isLoading && items.isEmpty {
                    Spacer()
                    ProgressView("Loading...")
                    Spacer()
                } else if selectedTab == 0 {
                    approvedItemsView
                } else {
                    pendingItemsView
                }
            }
            .navigationTitle("Community")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showingSubmitSheet = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .refreshable {
                await loadData()
            }
            .task {
                await loadData()
            }
            .sheet(isPresented: $showingSubmitSheet) {
                CommunitySubmitView(isPresented: $showingSubmitSheet) {
                    Task {
                        await loadData()
                    }
                }
            }
            .alert("Error", isPresented: .constant(errorMessage != nil)) {
                Button("OK") {
                    errorMessage = nil
                }
            } message: {
                Text(errorMessage ?? "")
            }
        }
    }

    private var approvedItemsView: some View {
        Group {
            if items.isEmpty {
                VStack(spacing: 16) {
                    Image(systemName: "person.3")
                        .font(.system(size: 48))
                        .foregroundStyle(.secondary)

                    Text("No community items yet")
                        .font(.title3)

                    Text("Be the first to share!")
                        .foregroundStyle(.secondary)

                    Button {
                        showingSubmitSheet = true
                    } label: {
                        Label("Submit Item", systemImage: "plus")
                    }
                    .buttonStyle(.borderedProminent)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    LazyVGrid(columns: columns, spacing: 16) {
                        ForEach(items) { item in
                            CommunityItemCard(item: item)
                        }
                    }
                    .padding()
                }
            }
        }
    }

    private var pendingItemsView: some View {
        Group {
            if pendingItems.isEmpty {
                VStack(spacing: 16) {
                    Image(systemName: "checkmark.circle")
                        .font(.system(size: 48))
                        .foregroundStyle(.green)

                    Text("No pending items")
                        .font(.title3)

                    Text("All caught up!")
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List {
                    ForEach(pendingItems) { item in
                        PendingItemRow(item: item) { action in
                            Task {
                                await handleAction(action, for: item)
                            }
                        }
                    }
                }
            }
        }
    }

    private func loadData() async {
        isLoading = true
        do {
            items = try await APIClient.shared.fetchCommunityItems()
            if authService.isAdmin {
                pendingItems = try await APIClient.shared.fetchPendingCommunityItems()
            }
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    private func handleAction(_ action: PendingAction, for item: CommunityItem) async {
        do {
            switch action {
            case .approve:
                try await APIClient.shared.approveCommunityItem(id: item.id)
            case .reject:
                try await APIClient.shared.rejectCommunityItem(id: item.id)
            }
            await loadData()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

enum PendingAction {
    case approve
    case reject
}

struct CommunityItemCard: View {
    let item: CommunityItem

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Image
            if let mainPhoto = item.mainPhoto, !mainPhoto.isEmpty {
                AsyncImage(url: URL(string: mainPhoto)) { phase in
                    switch phase {
                    case .empty:
                        Rectangle()
                            .fill(Color(.systemGray5))
                            .overlay { ProgressView() }
                    case .success(let image):
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                    case .failure:
                        Rectangle()
                            .fill(Color(.systemGray5))
                            .overlay {
                                Image(systemName: "photo")
                                    .foregroundStyle(.secondary)
                            }
                    @unknown default:
                        EmptyView()
                    }
                }
            } else {
                Rectangle()
                    .fill(Color(.systemGray5))
                    .overlay {
                        Image(systemName: "cube.box")
                            .font(.largeTitle)
                            .foregroundStyle(.secondary)
                    }
            }
        }
        .frame(height: 140)
        .clipped()

        VStack(alignment: .leading, spacing: 4) {
            Text(item.displayName)
                .font(.subheadline)
                .fontWeight(.medium)
                .lineLimit(1)

            if let category = item.category {
                Text(category.capitalized)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            if let submittedBy = item.submittedBy, !submittedBy.isEmpty {
                Text("by \(submittedBy)")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .shadow(color: .black.opacity(0.1), radius: 4, y: 2)
    }
}

struct PendingItemRow: View {
    let item: CommunityItem
    let onAction: (PendingAction) -> Void

    var body: some View {
        HStack(spacing: 12) {
            // Thumbnail
            if let mainPhoto = item.mainPhoto, !mainPhoto.isEmpty {
                AsyncImage(url: URL(string: mainPhoto)) { image in
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                } placeholder: {
                    Color(.systemGray5)
                }
                .frame(width: 60, height: 60)
                .clipShape(RoundedRectangle(cornerRadius: 8))
            } else {
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color(.systemGray5))
                    .frame(width: 60, height: 60)
                    .overlay {
                        Image(systemName: "cube.box")
                            .foregroundStyle(.secondary)
                    }
            }

            // Info
            VStack(alignment: .leading, spacing: 4) {
                Text(item.displayName)
                    .fontWeight(.medium)

                if let submittedBy = item.submittedBy {
                    Text("by \(submittedBy)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            Spacer()

            // Actions
            HStack(spacing: 8) {
                Button {
                    onAction(.reject)
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.title2)
                        .foregroundStyle(.red)
                }
                .buttonStyle(.borderless)

                Button {
                    onAction(.approve)
                } label: {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.title2)
                        .foregroundStyle(.green)
                }
                .buttonStyle(.borderless)
            }
        }
        .padding(.vertical, 4)
    }
}

struct CommunitySubmitView: View {
    @Binding var isPresented: Bool
    let onSubmit: () -> Void

    @State private var submission = CommunitySubmission()
    @State private var photoData: [Data] = []
    @State private var isSubmitting = false
    @State private var categories: [Category] = []

    var body: some View {
        NavigationStack {
            Form {
                Section("Item Info") {
                    TextField("Item Name", text: $submission.itemName)

                    Picker("Category", selection: $submission.category) {
                        Text("Select").tag("")
                        ForEach(categories) { cat in
                            Text(cat.displayName).tag(cat.name)
                        }
                    }
                }

                Section("Description") {
                    TextEditor(text: $submission.description)
                        .frame(minHeight: 80)
                }

                Section("Your Name") {
                    TextField("Name (optional)", text: $submission.submittedBy)
                }

                Section("Photo") {
                    PhotoPicker(selectedPhotos: $photoData, maxPhotos: 1)
                }
            }
            .navigationTitle("Submit Item")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        isPresented = false
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Submit") {
                        Task {
                            await submit()
                        }
                    }
                    .disabled(submission.itemName.isEmpty || isSubmitting)
                }
            }
            .overlay {
                if isSubmitting {
                    Color.black.opacity(0.3)
                        .ignoresSafeArea()
                        .overlay {
                            ProgressView("Submitting...")
                                .padding()
                                .background(.regularMaterial)
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                        }
                }
            }
            .task {
                do {
                    categories = try await APIClient.shared.fetchCategories()
                } catch {
                    // Ignore errors loading categories
                }
            }
        }
    }

    private func submit() async {
        isSubmitting = true
        submission.photo = photoData.first

        do {
            _ = try await APIClient.shared.submitCommunityItem(submission)
            isSubmitting = false
            isPresented = false
            onSubmit()
        } catch {
            isSubmitting = false
            // Handle error
        }
    }
}

#Preview {
    CommunityView(authService: AuthService.shared)
}
