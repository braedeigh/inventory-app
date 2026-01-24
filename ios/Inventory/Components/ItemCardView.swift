import SwiftUI

struct ItemCardView: View {
    let item: Item
    var showPrivacyIndicator: Bool = true

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Image
            ZStack(alignment: .topTrailing) {
                if let mainPhoto = item.mainPhoto, !mainPhoto.isEmpty {
                    AsyncImage(url: URL(string: mainPhoto)) { phase in
                        switch phase {
                        case .empty:
                            Rectangle()
                                .fill(Color(.systemGray5))
                                .overlay {
                                    ProgressView()
                                }
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

                // Badges
                if showPrivacyIndicator {
                    HStack(spacing: 4) {
                        if item.isPrivate {
                            Image(systemName: "lock.fill")
                                .font(.caption2)
                                .padding(4)
                                .background(.ultraThinMaterial)
                                .clipShape(Circle())
                        }
                        if item.isGifted {
                            Image(systemName: "gift.fill")
                                .font(.caption2)
                                .foregroundStyle(.pink)
                                .padding(4)
                                .background(.ultraThinMaterial)
                                .clipShape(Circle())
                        }
                    }
                    .padding(8)
                }
            }
            .frame(height: 140)
            .clipped()

            // Info
            VStack(alignment: .leading, spacing: 4) {
                Text(item.displayName)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .lineLimit(1)

                if let category = item.category {
                    Text(category.capitalized)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }

                // Source badge
                HStack(spacing: 4) {
                    sourceIcon
                        .font(.caption2)
                    Text(item.sourceType.displayName)
                        .font(.caption2)
                }
                .foregroundStyle(sourceColor)
            }
            .padding(10)
        }
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .shadow(color: .black.opacity(0.1), radius: 4, y: 2)
    }

    private var sourceIcon: Image {
        switch item.sourceType {
        case .new:
            return Image(systemName: "sparkles")
        case .secondhand:
            return Image(systemName: "arrow.triangle.2.circlepath")
        case .handmade:
            return Image(systemName: "hand.raised.fill")
        case .unknown:
            return Image(systemName: "questionmark")
        }
    }

    private var sourceColor: Color {
        switch item.sourceType {
        case .new:
            return .blue
        case .secondhand:
            return .green
        case .handmade:
            return .orange
        case .unknown:
            return .secondary
        }
    }
}

#Preview {
    ItemCardView(item: Item(
        id: "1",
        itemName: "Test Item",
        description: "A test description",
        category: "clothing",
        origin: "Test origin",
        mainPhoto: nil,
        createdAt: nil,
        subcategory: nil,
        secondhand: "secondhand",
        lastEdited: nil,
        gifted: "true",
        private: "false",
        materials: nil,
        privatePhotos: nil,
        privateDescription: nil,
        privateOrigin: nil,
        pinnedX: nil,
        pinnedY: nil,
        localCol: nil,
        localRow: nil,
        photos: nil
    ))
    .frame(width: 180)
    .padding()
}
