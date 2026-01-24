import SwiftUI

struct FilterView: View {
    @Binding var filterState: FilterState
    let categories: [Category]
    let subcategories: [Subcategory]
    let materials: [Material]

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                // Active filters summary
                if filterState.hasActiveFilters {
                    Section {
                        Button(role: .destructive) {
                            filterState.reset()
                        } label: {
                            HStack {
                                Image(systemName: "xmark.circle.fill")
                                Text("Clear all filters")
                            }
                        }
                    }
                }

                // Category
                Section("Category") {
                    Picker("Category", selection: $filterState.selectedCategory) {
                        Text("All categories").tag(nil as String?)
                        ForEach(categories) { category in
                            Text(category.displayName).tag(category.name as String?)
                        }
                    }
                    .pickerStyle(.menu)

                    if filterState.selectedCategory != nil && !subcategories.isEmpty {
                        Picker("Subcategory", selection: $filterState.selectedSubcategory) {
                            Text("All subcategories").tag(nil as String?)
                            ForEach(subcategories) { sub in
                                Text(sub.displayName).tag(sub.name as String?)
                            }
                        }
                        .pickerStyle(.menu)
                    }
                }

                // Source
                Section("Source") {
                    Picker("Source type", selection: $filterState.selectedSource) {
                        Text("All sources").tag(nil as SourceType?)
                        ForEach(SourceType.allCases, id: \.self) { source in
                            Text(source.displayName).tag(source as SourceType?)
                        }
                    }
                    .pickerStyle(.menu)

                    Toggle("Gifted items only", isOn: $filterState.showGiftedOnly)
                }

                // Materials
                Section("Materials") {
                    if materials.isEmpty {
                        Text("No materials available")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(materials) { material in
                            HStack {
                                Text(material.name)
                                Spacer()
                                if filterState.selectedMaterials.contains(material.name) {
                                    Image(systemName: "checkmark")
                                        .foregroundStyle(.blue)
                                }
                            }
                            .contentShape(Rectangle())
                            .onTapGesture {
                                if filterState.selectedMaterials.contains(material.name) {
                                    filterState.selectedMaterials.remove(material.name)
                                } else {
                                    filterState.selectedMaterials.insert(material.name)
                                }
                            }
                        }
                    }
                }

                // Sort
                Section("Sort by") {
                    Picker("Sort order", selection: $filterState.sortOption) {
                        ForEach(SortOption.allCases, id: \.self) { option in
                            Text(option.displayName).tag(option)
                        }
                    }
                    .pickerStyle(.segmented)
                }
            }
            .navigationTitle("Filters")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
            .onChange(of: filterState.selectedCategory) { _, newValue in
                // Reset subcategory when category changes
                if newValue == nil {
                    filterState.selectedSubcategory = nil
                }
            }
        }
        .presentationDetents([.medium, .large])
    }
}

#Preview {
    FilterView(
        filterState: .constant(FilterState()),
        categories: [
            Category(id: "1", name: "clothing", displayName: "Clothing"),
            Category(id: "2", name: "accessories", displayName: "Accessories")
        ],
        subcategories: [],
        materials: [
            Material(id: "1", name: "Cotton"),
            Material(id: "2", name: "Wool")
        ]
    )
}
