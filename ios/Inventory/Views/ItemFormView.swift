import SwiftUI

struct ItemFormView: View {
    @ObservedObject var viewModel: InventoryViewModel
    @Binding var isPresented: Bool
    var editingItem: Item?

    @State private var itemName = ""
    @State private var description = ""
    @State private var selectedCategory = ""
    @State private var selectedSubcategory = ""
    @State private var origin = ""
    @State private var sourceType: SourceType = .unknown
    @State private var isGifted = false
    @State private var isPrivate = false
    @State private var privatePhotos = false
    @State private var privateDescription = false
    @State private var privateOrigin = false
    @State private var selectedMaterials: [ItemMaterial] = []
    @State private var photos: [Data] = []

    @State private var showingAddCategory = false
    @State private var showingAddSubcategory = false
    @State private var showingAddMaterial = false
    @State private var newCategoryName = ""
    @State private var newSubcategoryName = ""
    @State private var newMaterialName = ""
    @State private var selectedMaterialToAdd = ""
    @State private var materialPercentage = 100

    @State private var isSaving = false

    var isEditing: Bool {
        editingItem != nil
    }

    var subcategoriesForCategory: [Subcategory] {
        viewModel.subcategories.filter { $0.category == selectedCategory }
    }

    var body: some View {
        NavigationStack {
            Form {
                basicInfoSection
                descriptionSection
                originSection
                sourceSection
                materialsSection
                photosSection
                privacySection
            }
            .navigationTitle(isEditing ? "Edit Item" : "New Item")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                toolbarContent
            }
            .overlay {
                savingOverlay
            }
            .onAppear {
                if let item = editingItem {
                    loadItemData(item)
                }
            }
            .alert("Add Category", isPresented: $showingAddCategory) {
                addCategoryAlert
            }
            .alert("Add Subcategory", isPresented: $showingAddSubcategory) {
                addSubcategoryAlert
            }
            .alert("Add Material", isPresented: $showingAddMaterial) {
                addMaterialAlert
            }
        }
    }

    // MARK: - Form Sections

    private var basicInfoSection: some View {
        Section("Basic Info") {
            TextField("Item Name", text: $itemName)

            Picker("Category", selection: $selectedCategory) {
                Text("Select category").tag("")
                ForEach(viewModel.categories) { category in
                    Text(category.displayName).tag(category.name)
                }
            }

            if !selectedCategory.isEmpty && !subcategoriesForCategory.isEmpty {
                Picker("Subcategory", selection: $selectedSubcategory) {
                    Text("None").tag("")
                    ForEach(subcategoriesForCategory) { sub in
                        Text(sub.displayName).tag(sub.name)
                    }
                }
            }

            categoryButtons
        }
    }

    private var categoryButtons: some View {
        HStack {
            Button("+ Category") {
                showingAddCategory = true
            }
            .font(.caption)

            if !selectedCategory.isEmpty {
                Button("+ Subcategory") {
                    showingAddSubcategory = true
                }
                .font(.caption)
            }
        }
        .buttonStyle(.borderless)
    }

    private var descriptionSection: some View {
        Section("Description") {
            TextEditor(text: $description)
                .frame(minHeight: 100)

            Toggle("Private description", isOn: $privateDescription)
        }
    }

    private var originSection: some View {
        Section("Origin") {
            TextField("Where did you get this?", text: $origin)

            Toggle("Private origin", isOn: $privateOrigin)
        }
    }

    private var sourceSection: some View {
        Section("Source") {
            Picker("How was it acquired?", selection: $sourceType) {
                ForEach(SourceType.allCases, id: \.self) { source in
                    Text(source.displayName).tag(source)
                }
            }
            .pickerStyle(.segmented)

            Toggle("This was a gift", isOn: $isGifted)
        }
    }

    private var materialsSection: some View {
        Section("Materials") {
            materialsList
            materialPicker
            addMaterialButton
        }
    }

    private var materialsList: some View {
        ForEach(Array(selectedMaterials.enumerated()), id: \.offset) { index, material in
            MaterialRowView(
                material: material,
                onDelete: { selectedMaterials.remove(at: index) }
            )
        }
    }

    @ViewBuilder
    private var materialPicker: some View {
        if !viewModel.materials.isEmpty {
            MaterialPickerView(
                materials: viewModel.materials,
                selectedMaterials: selectedMaterials,
                selectedMaterialToAdd: $selectedMaterialToAdd,
                materialPercentage: $materialPercentage,
                onAdd: {
                    selectedMaterials.append(ItemMaterial(
                        material: selectedMaterialToAdd,
                        percentage: materialPercentage
                    ))
                    selectedMaterialToAdd = ""
                    materialPercentage = 100
                }
            )
        }
    }

    private var addMaterialButton: some View {
        Button("+ New Material") {
            showingAddMaterial = true
        }
        .font(.caption)
    }

    @ViewBuilder
    private var photosSection: some View {
        if !isEditing {
            Section("Photos") {
                PhotoPicker(selectedPhotos: $photos, maxPhotos: 5)

                Toggle("Private photos", isOn: $privatePhotos)
            }
        }
    }

    private var privacySection: some View {
        Section("Privacy") {
            Toggle("Make entire item private", isOn: $isPrivate)

            if isPrivate {
                Text("This item will only be visible to you")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }

    // MARK: - Toolbar

    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        ToolbarItem(placement: .cancellationAction) {
            Button("Cancel") {
                isPresented = false
            }
        }

        ToolbarItem(placement: .confirmationAction) {
            Button(isEditing ? "Save" : "Add") {
                Task {
                    await saveItem()
                }
            }
            .disabled(itemName.isEmpty || isSaving)
        }
    }

    // MARK: - Overlays

    @ViewBuilder
    private var savingOverlay: some View {
        if isSaving {
            Color.black.opacity(0.3)
                .ignoresSafeArea()
                .overlay {
                    ProgressView(isEditing ? "Saving..." : "Adding...")
                        .padding()
                        .background(.regularMaterial)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                }
        }
    }

    // MARK: - Alerts

    @AlertContentBuilder
    private var addCategoryAlert: some View {
        TextField("Category name", text: $newCategoryName)
        Button("Cancel", role: .cancel) {
            newCategoryName = ""
        }
        Button("Add") {
            Task {
                if await viewModel.addCategory(name: newCategoryName) {
                    selectedCategory = newCategoryName.lowercased().replacingOccurrences(of: " ", with: "-")
                }
                newCategoryName = ""
            }
        }
    }

    @AlertContentBuilder
    private var addSubcategoryAlert: some View {
        TextField("Subcategory name", text: $newSubcategoryName)
        Button("Cancel", role: .cancel) {
            newSubcategoryName = ""
        }
        Button("Add") {
            Task {
                if await viewModel.addSubcategory(name: newSubcategoryName, category: selectedCategory) {
                    selectedSubcategory = newSubcategoryName.lowercased().replacingOccurrences(of: " ", with: "-")
                }
                newSubcategoryName = ""
            }
        }
    }

    @AlertContentBuilder
    private var addMaterialAlert: some View {
        TextField("Material name", text: $newMaterialName)
        Button("Cancel", role: .cancel) {
            newMaterialName = ""
        }
        Button("Add") {
            Task {
                if await viewModel.addMaterial(name: newMaterialName) {
                    selectedMaterialToAdd = newMaterialName.prefix(1).uppercased() + newMaterialName.dropFirst().lowercased()
                }
                newMaterialName = ""
            }
        }
    }

    // MARK: - Actions

    private func loadItemData(_ item: Item) {
        itemName = item.itemName ?? ""
        description = item.description ?? ""
        selectedCategory = item.category ?? ""
        selectedSubcategory = item.subcategory ?? ""
        origin = item.origin ?? ""
        sourceType = item.sourceType
        isGifted = item.isGifted
        isPrivate = item.isPrivate
        privatePhotos = item.privatePhotos == "true"
        privateDescription = item.privateDescription == "true"
        privateOrigin = item.privateOrigin == "true"
        selectedMaterials = item.materials ?? []
    }

    private func saveItem() async {
        isSaving = true

        let request = CreateItemRequest(
            itemName: itemName,
            description: description,
            category: selectedCategory,
            subcategory: selectedSubcategory,
            origin: origin,
            secondhand: sourceType.rawValue,
            gifted: isGifted ? "true" : "false",
            isPrivate: isPrivate,
            privatePhotos: privatePhotos,
            privateDescription: privateDescription,
            privateOrigin: privateOrigin,
            materials: selectedMaterials,
            photos: photos,
            mainPhotoIndex: 0
        )

        let success: Bool
        if let item = editingItem {
            success = await viewModel.updateItem(id: item.id, request: request)
        } else {
            success = await viewModel.createItem(request)
        }

        isSaving = false

        if success {
            isPresented = false
        }
    }
}

// MARK: - Helper Views

private struct MaterialRowView: View {
    let material: ItemMaterial
    let onDelete: () -> Void

    var body: some View {
        HStack {
            Text(material.material ?? "Unknown")
            Spacer()
            if let percentage = material.percentage {
                Text("\(percentage)%")
                    .foregroundStyle(.secondary)
            }
            Button(action: onDelete) {
                Image(systemName: "minus.circle.fill")
                    .foregroundStyle(.red)
            }
            .buttonStyle(.borderless)
        }
    }
}

private struct MaterialPickerView: View {
    let materials: [Material]
    let selectedMaterials: [ItemMaterial]
    @Binding var selectedMaterialToAdd: String
    @Binding var materialPercentage: Int
    let onAdd: () -> Void

    var availableMaterials: [Material] {
        materials.filter { mat in
            !selectedMaterials.contains { $0.material == mat.name }
        }
    }

    var body: some View {
        HStack {
            Picker("Add material", selection: $selectedMaterialToAdd) {
                Text("Select").tag("")
                ForEach(availableMaterials) { material in
                    Text(material.name).tag(material.name)
                }
            }

            if !selectedMaterialToAdd.isEmpty {
                addMaterialControls
            }
        }
    }

    private var addMaterialControls: some View {
        HStack {
            Stepper("\(materialPercentage)%", value: $materialPercentage, in: 1...100, step: 5)
                .frame(width: 140)

            Button(action: onAdd) {
                Image(systemName: "plus.circle.fill")
                    .foregroundStyle(.green)
            }
            .buttonStyle(.borderless)
        }
    }
}

// MARK: - Alert Content Builder

@resultBuilder
struct AlertContentBuilder {
    static func buildBlock(_ components: some View...) -> some View {
        ForEach(Array(components.enumerated()), id: \.offset) { _, component in
            component
        }
    }
}

#Preview {
    ItemFormView(
        viewModel: InventoryViewModel(),
        isPresented: .constant(true)
    )
}
