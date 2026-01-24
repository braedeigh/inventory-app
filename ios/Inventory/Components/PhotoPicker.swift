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
            headerView
            scrollContent
        }
        .onChange(of: photoPickerItems) { _, newItems in
            handlePhotoSelection(newItems)
        }
    }

    private var headerView: some View {
        HStack {
            Text("Photos")
                .font(.headline)
            Spacer()
            Text("\(selectedPhotos.count)/\(maxPhotos)")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    private var scrollContent: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                selectedPhotosView
                addButtonView
            }
        }
    }

    private var selectedPhotosView: some View {
        ForEach(Array(selectedPhotos.enumerated()), id: \.offset) { index, photoData in
            photoThumbnail(photoData: photoData, index: index)
        }
    }

    private func photoThumbnail(photoData: Data, index: Int) -> some View {
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

    @ViewBuilder
    private var addButtonView: some View {
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

    private func handlePhotoSelection(_ newItems: [PhotosPickerItem]) {
        Task {
            for item in newItems {
                if let data = try? await item.loadTransferable(type: Data.self) {
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

#Preview {
    PhotoPicker(selectedPhotos: .constant([]), maxPhotos: 5)
        .padding()
}
