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
                // Basic Info
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

                // Description
                Section("Description") {
                    TextEditor(text: $description)
                        .frame(minHeight: 100)

                    Toggle("Private description", isOn: $privateDescription)
                }

                // Origin
                Section("Origin") {
                    TextField("Where did you get this?", text: $origin)

                    Toggle("Private origin", isOn: $privateOrigin)
                }

                // Source
                Section("Source") {
                    Picker("How was it acquired?", selection: $sourceType) {
                        ForEach(SourceType.allCases, id: \.self) { source in
                            Text(source.displayName).tag(source)
                        }
                    }
                    .pickerStyle(.segmented)

                    Toggle("This was a gift", isOn: $isGifted)
                }

                // Materials
                Section("Materials") {
                    ForEach(Array(selectedMaterials.enumerated()), id: \.offset) { index, material in
                        HStack {
                            Text(material.material)
                            Spacer()
                            Text("\(material.percentage)%")
                                .foregroundStyle(.secondary)
                            Button {
                                selectedMaterials.remove(at: index)
                            } label: {
                                Image(systemName: "minus.circle.fill")
                                    .foregroundStyle(.red)
                            }
                            .buttonStyle(.borderless)
                        }
                    }

                    if !viewModel.materials.isEmpty {
                        HStack {
                            Picker("Add material", selection: $selectedMaterialToAdd) {
                                Text("Select").tag("")
                                ForEach(viewModel.materials.filter { mat in
                                    !selectedMaterials.contains { $0.material == mat.name }
                                }) { material in
                                    Text(material.name).tag(material.name)
                                }
                            }

                            if !selectedMaterialToAdd.isEmpty {
                                Stepper("\(materialPercentage)%", value: $materialPercentage, in: 1...100, step: 5)
                                    .frame(width: 140)

                                Button {
                                    selectedMaterials.append(ItemMaterial(
                                        material: selectedMaterialToAdd,
                                        percentage: materialPercentage
                                    ))
                                    selectedMaterialToAdd = ""
                                    materialPercentage = 100
                                } label: {
                                    Image(systemName: "plus.circle.fill")
                                        .foregroundStyle(.green)
                                }
                                .buttonStyle(.borderless)
                            }
                        }
                    }

                    Button("+ New Material") {
                        showingAddMaterial = true
                    }
                    .font(.caption)
                }

                // Photos (only for new items)
                if !isEditing {
                    Section("Photos") {
                        PhotoPicker(selectedPhotos: $photos, maxPhotos: 5)

                        Toggle("Private photos", isOn: $privatePhotos)
                    }
                }

                // Privacy
                Section("Privacy") {
                    Toggle("Make entire item private", isOn: $isPrivate)

                    if isPrivate {
                        Text("This item will only be visible to you")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .navigationTitle(isEditing ? "Edit Item" : "New Item")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
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
            .overlay {
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
            .onAppear {
                if let item = editingItem {
                    loadItemData(item)
                }
            }
            .alert("Add Category", isPresented: $showingAddCategory) {
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
            .alert("Add Subcategory", isPresented: $showingAddSubcategory) {
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
            .alert("Add Material", isPresented: $showingAddMaterial) {
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
        }
    }

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

#Preview {
    ItemFormView(
        viewModel: InventoryViewModel(),
        isPresented: .constant(true)
    )
}
