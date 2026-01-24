import SwiftUI

struct ItemDetailView: View {
    let item: Item
    @ObservedObject var viewModel: InventoryViewModel
    @ObservedObject var authService: AuthService

    @State private var showingEditSheet = false
    @State private var showingDeleteAlert = false
    @State private var isDeleting = false

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                // Photo carousel
                ImageCarousel(imageURLs: item.allPhotos)
                    .frame(height: 350)

                VStack(alignment: .leading, spacing: 20) {
                    // Header
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text(item.displayName)
                                .font(.title)
                                .fontWeight(.bold)

                            Spacer()

                            // Badges
                            HStack(spacing: 8) {
                                if item.isPrivate {
                                    Label("Private", systemImage: "lock.fill")
                                        .font(.caption)
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 4)
                                        .background(Color(.systemGray5))
                                        .clipShape(Capsule())
                                }

                                if item.isGifted {
                                    Label("Gift", systemImage: "gift.fill")
                                        .font(.caption)
                                        .foregroundStyle(.pink)
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 4)
                                        .background(Color.pink.opacity(0.1))
                                        .clipShape(Capsule())
                                }
                            }
                        }

                        // Category & Source
                        HStack(spacing: 16) {
                            if let category = item.category {
                                Label(category.capitalized, systemImage: "tag")
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }

                            if let subcategory = item.subcategory, !subcategory.isEmpty {
                                Text(subcategory.capitalized)
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                        }

                        sourceBadge
                    }

                    Divider()

                    // Description
                    if let description = item.description, !description.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Description")
                                .font(.headline)

                            Text(description)
                                .foregroundStyle(.secondary)
                        }

                        Divider()
                    }

                    // Origin
                    if let origin = item.origin, !origin.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Origin")
                                .font(.headline)

                            Text(origin)
                                .foregroundStyle(.secondary)
                        }

                        Divider()
                    }

                    // Materials
                    if let materials = item.materials, !materials.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Materials")
                                .font(.headline)

                            FlowLayout(spacing: 8) {
                                ForEach(materials, id: \.material) { material in
                                    HStack(spacing: 4) {
                                        Text(material.material)
                                        if material.percentage > 0 && material.percentage < 100 {
                                            Text("(\(material.percentage)%)")
                                                .foregroundStyle(.secondary)
                                        }
                                    }
                                    .font(.subheadline)
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 6)
                                    .background(Color(.systemGray6))
                                    .clipShape(Capsule())
                                }
                            }
                        }

                        Divider()
                    }

                    // Metadata
                    VStack(alignment: .leading, spacing: 8) {
                        if let createdAt = item.createdAt {
                            HStack {
                                Text("Added")
                                    .foregroundStyle(.secondary)
                                Spacer()
                                Text(formatDate(createdAt))
                            }
                            .font(.subheadline)
                        }

                        if let lastEdited = item.lastEdited {
                            HStack {
                                Text("Last edited")
                                    .foregroundStyle(.secondary)
                                Spacer()
                                Text(formatDate(lastEdited))
                            }
                            .font(.subheadline)
                        }
                    }
                }
                .padding()
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if authService.isAdmin {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button {
                            showingEditSheet = true
                        } label: {
                            Label("Edit", systemImage: "pencil")
                        }

                        Button(role: .destructive) {
                            showingDeleteAlert = true
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
            }
        }
        .sheet(isPresented: $showingEditSheet) {
            ItemFormView(
                viewModel: viewModel,
                isPresented: $showingEditSheet,
                editingItem: item
            )
        }
        .alert("Delete Item", isPresented: $showingDeleteAlert) {
            Button("Cancel", role: .cancel) { }
            Button("Delete", role: .destructive) {
                Task {
                    isDeleting = true
                    if await viewModel.deleteItem(item) {
                        dismiss()
                    }
                    isDeleting = false
                }
            }
        } message: {
            Text("Are you sure you want to delete \"\(item.displayName)\"? This action cannot be undone.")
        }
        .overlay {
            if isDeleting {
                Color.black.opacity(0.3)
                    .ignoresSafeArea()
                    .overlay {
                        ProgressView("Deleting...")
                            .padding()
                            .background(.regularMaterial)
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                    }
            }
        }
    }

    private var sourceBadge: some View {
        HStack(spacing: 6) {
            switch item.sourceType {
            case .new:
                Image(systemName: "sparkles")
                Text("New")
            case .secondhand:
                Image(systemName: "arrow.triangle.2.circlepath")
                Text("Secondhand")
            case .handmade:
                Image(systemName: "hand.raised.fill")
                Text("Handmade")
            case .unknown:
                Image(systemName: "questionmark")
                Text("Unknown")
            }
        }
        .font(.subheadline)
        .foregroundStyle(sourceColor)
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(sourceColor.opacity(0.1))
        .clipShape(Capsule())
    }

    private var sourceColor: Color {
        switch item.sourceType {
        case .new: return .blue
        case .secondhand: return .green
        case .handmade: return .orange
        case .unknown: return .secondary
        }
    }

    private func formatDate(_ dateString: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        if let date = formatter.date(from: dateString) {
            let displayFormatter = DateFormatter()
            displayFormatter.dateStyle = .medium
            displayFormatter.timeStyle = .short
            return displayFormatter.string(from: date)
        }

        // Try without fractional seconds
        formatter.formatOptions = [.withInternetDateTime]
        if let date = formatter.date(from: dateString) {
            let displayFormatter = DateFormatter()
            displayFormatter.dateStyle = .medium
            displayFormatter.timeStyle = .short
            return displayFormatter.string(from: date)
        }

        return dateString
    }
}

// Simple flow layout for materials
struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = FlowResult(in: proposal.width ?? 0, subviews: subviews, spacing: spacing)
        return result.size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = FlowResult(in: bounds.width, subviews: subviews, spacing: spacing)
        for (index, subview) in subviews.enumerated() {
            subview.place(at: CGPoint(x: bounds.minX + result.positions[index].x,
                                       y: bounds.minY + result.positions[index].y),
                          proposal: .unspecified)
        }
    }

    struct FlowResult {
        var size: CGSize = .zero
        var positions: [CGPoint] = []

        init(in maxWidth: CGFloat, subviews: Subviews, spacing: CGFloat) {
            var x: CGFloat = 0
            var y: CGFloat = 0
            var rowHeight: CGFloat = 0

            for subview in subviews {
                let size = subview.sizeThatFits(.unspecified)

                if x + size.width > maxWidth && x > 0 {
                    x = 0
                    y += rowHeight + spacing
                    rowHeight = 0
                }

                positions.append(CGPoint(x: x, y: y))
                rowHeight = max(rowHeight, size.height)
                x += size.width + spacing
            }

            self.size = CGSize(width: maxWidth, height: y + rowHeight)
        }
    }
}

#Preview {
    NavigationStack {
        ItemDetailView(
            item: Item(
                id: "1",
                itemName: "Test Item",
                description: "A detailed description of this test item that spans multiple lines.",
                category: "clothing",
                origin: "Found at a thrift store",
                mainPhoto: nil,
                createdAt: "2024-01-15T10:30:00Z",
                subcategory: "shirt",
                secondhand: "secondhand",
                lastEdited: nil,
                gifted: "true",
                private: "false",
                materials: [
                    ItemMaterial(material: "Cotton", percentage: 80),
                    ItemMaterial(material: "Polyester", percentage: 20)
                ],
                privatePhotos: nil,
                privateDescription: nil,
                privateOrigin: nil,
                pinnedX: nil,
                pinnedY: nil,
                localCol: nil,
                localRow: nil,
                photos: nil
            ),
            viewModel: InventoryViewModel(),
            authService: AuthService.shared
        )
    }
}
