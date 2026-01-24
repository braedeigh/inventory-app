import SwiftUI
import PhotosUI

struct PhotoPicker: View {
    @Binding var selectedPhotos: [Data]
    let maxPhotos: Int

    @State private var photoPickerItems: [PhotosPickerItem] = []

    var canAddMore: Bool {
        selectedPhotos.count < maxPhotos
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Photos")
                    .font(.headline)
                Spacer()
                Text("\(selectedPhotos.count)/\(maxPhotos)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    // Selected photos
                    ForEach(Array(selectedPhotos.enumerated()), id: \.offset) { index, photoData in
                        ZStack(alignment: .topTrailing) {
                            if let uiImage = UIImage(data: photoData) {
                                Image(uiImage: uiImage)
                                    .resizable()
                                    .aspectRatio(contentMode: .fill)
                                    .frame(width: 80, height: 80)
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                            }

                            Button {
                                withAnimation {
                                    selectedPhotos.remove(at: index)
                                }
                            } label: {
                                Image(systemName: "xmark.circle.fill")
                                    .font(.title3)
                                    .foregroundStyle(.white, .red)
                            }
                            .offset(x: 6, y: -6)
                        }
                    }

                    // Add photo button
                    if canAddMore {
                        PhotosPicker(
                            selection: $photoPickerItems,
                            maxSelectionCount: maxPhotos - selectedPhotos.count,
                            matching: .images
                        ) {
                            VStack {
                                Image(systemName: "plus")
                                    .font(.title2)
                                Text("Add")
                                    .font(.caption)
                            }
                            .frame(width: 80, height: 80)
                            .background(Color(.systemGray6))
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                    }
                }
            }
        }
        .onChange(of: photoPickerItems) { _, newItems in
            Task {
                for item in newItems {
                    if let data = try? await item.loadTransferable(type: Data.self) {
                        // Compress image
                        if let uiImage = UIImage(data: data),
                           let compressed = uiImage.jpegData(compressionQuality: 0.7) {
                            await MainActor.run {
                                if selectedPhotos.count < maxPhotos {
                                    selectedPhotos.append(compressed)
                                }
                            }
                        }
                    }
                }
                await MainActor.run {
                    photoPickerItems = []
                }
            }
        }
    }
}

#Preview {
    PhotoPicker(selectedPhotos: .constant([]), maxPhotos: 5)
        .padding()
}
