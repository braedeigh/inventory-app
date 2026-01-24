import SwiftUI

struct ImageCarousel: View {
    let imageURLs: [String]
    @State private var currentIndex = 0

    var body: some View {
        if imageURLs.isEmpty {
            placeholderView
        } else {
            VStack(spacing: 0) {
                TabView(selection: $currentIndex) {
                    ForEach(Array(imageURLs.enumerated()), id: \.offset) { index, url in
                        AsyncImage(url: URL(string: url)) { phase in
                            switch phase {
                            case .empty:
                                Rectangle()
                                    .fill(Color(.systemGray6))
                                    .overlay {
                                        ProgressView()
                                    }
                            case .success(let image):
                                image
                                    .resizable()
                                    .aspectRatio(contentMode: .fit)
                            case .failure:
                                Rectangle()
                                    .fill(Color(.systemGray6))
                                    .overlay {
                                        Image(systemName: "photo")
                                            .font(.largeTitle)
                                            .foregroundStyle(.secondary)
                                    }
                            @unknown default:
                                EmptyView()
                            }
                        }
                        .tag(index)
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .never))

                // Custom page indicator
                if imageURLs.count > 1 {
                    HStack(spacing: 6) {
                        ForEach(0..<imageURLs.count, id: \.self) { index in
                            Circle()
                                .fill(index == currentIndex ? Color.primary : Color.secondary.opacity(0.5))
                                .frame(width: 6, height: 6)
                        }
                    }
                    .padding(.vertical, 12)
                }
            }
        }
    }

    private var placeholderView: some View {
        Rectangle()
            .fill(Color(.systemGray6))
            .overlay {
                VStack(spacing: 8) {
                    Image(systemName: "cube.box")
                        .font(.system(size: 48))
                    Text("No photos")
                        .font(.caption)
                }
                .foregroundStyle(.secondary)
            }
    }
}

#Preview {
    ImageCarousel(imageURLs: [])
        .frame(height: 300)
}
