---
layout: default
title: IDS4Revit
parent: IDS4Revit User Guide
nav_order: 1
---

# General Guide
{: .no_toc }

The plugin button is located in the DiRootsOne tab, next to IDS4Revit, providing access to the main functions via three tabs:
- Entity Inspector Tab: Allows users to find elements based on the IDS file.
- Map Parameters Tab: Helps users map the data origin to the required IDS data.
- Property Inspector Tab: Allows users to check and inspect property restrictions based on the IDS file.

![IDS4Revit Open](../../../assets\images\GIFs\2.0-IDS4Revit-Open.gif)  
<sub>Note: the version on the image may not reflect the [latest version of IDS4Revit]().</sub>

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Selecting the IDS file

In the main window, the user can select the IDS file. We offer support for IDS versions 1.0 and above. If the selected file does not conform to the correct IDS schema definition, an error message will be triggered, and the IDS file will not be loaded.

![IDS4Revit Select IDS](../../../assets\images\GIFs\2.1-IDS4Revit-SelectIDS.gif)  
<sub>Note: the version on the image may not reflect the [latest version of IDS4Revit]().</sub>

### Inspecting IDS file entities

The Inspector tab displays the IFC entities required based on the IDS specifications. The user interface will show the Revit elements related to these entities and will count them for the currently selected scope of elements—either the entire model or the active view.
If there are IDS requirements on the number of elements needed on the result IFC file, the application will display a red cell on the UI and will trigger a message if the exportation doesn’t meet the criteria. 

Users can inspect elements in Revit by selecting, isolating, or creating a section box of the elements using the provided buttons. If IDS requirements specify a particular number of elements for the exported IFC file, a red cell will display in the UI, accompanied by a message if the export criteria are not met.

![IDS4Revit Inspect Object](../../../assets\images\GIFs\2.2-IDS4Revit-InspectObject.gif)  
<sub>Note: the version on the image may not reflect the [latest version of IDS4Revit]().</sub>

### Mapping the properties

The Map Parameters tab enables users to easily map user-defined properties and predefined IfcProperties from the IDS file to Revit parameters.~

- Mapping Custom Properties: Users can associate Revit parameters with the selected IDS properties, allowing seamless data mapping.
- Mapping Predefined IFC Properties: For the predefined IfcProperties from the IFC schema, the user interface displays these properties with the ‘Pset_’ suffix. Only Revit parameters compatible with the type are displayed for mapping. For these IfcProperties, users can set default mappings by using the button next to the Parameter column, as some IfcProperties have pre-mapped Revit parameters.

![IDS4Revit Map Properties](../../../assets\images\GIFs\2.3-IDS4Revit-MapProperties.gif)  
<sub>Note: the version on the image may not reflect the [latest version of IDS4Revit]().</sub>

### Inspecting IDS file properties

The property inspector tab will display the property entities with restrictions based on the IDS specifications after the properties are mapped.

![IDS4Revit Inspect Properties](../../../assets\images\GIFs\2.4-IDS4Revit-InspectProperties.gif)  
<sub>Note: the version on the image may not reflect the [latest version of IDS4Revit]().</sub>

If the property restriction does not comply with the scope of elements, the user interface will display a red background on the restriction status column. 

The user can inspect the elements in Revit by selecting, isolating, or creating a section box with the related buttons.

![IDS4Revit Select, Isolate and Section Box](../../../assets\images\GIFs\2.4b-IDS4Revit-Select,Isolate,SectionBox.gif)  
<sub>Note: the version on the image may not reflect the [latest version of IDS4Revit]().</sub>

### Exporting to IFC (IDS-based IFC exporter)

BuildingSmart defines IDS as a set of outlined specifications that are expected to be in the IFC file. The tool helps users export models to IFC based on these IDS requirements, specifically supporting data mapping for property facets and entity identification. Additional facets are not covered at this stage, and DiRoots IDS4Revit exporter does not guarantee full compliance with the IDS requirements as it uses the same Revit IFC exporter.

#### Selecting additional configuration

The tool allows users to customize multiple IFC settings based on their requirements. Users can use their different IFC export setups as a base, applying the additional configurations on top of the existing IFC export setup.

![IDS4Revit Select IFC configuration](../../../assets\images\GIFs\2.5.1-IDS4Revit-SelectIFCconfig.gif)  
<sub>Note: the version on the image may not reflect the [latest version of IDS4Revit]().</sub>

#### Exportation process

After setting up configurations and additional parameters, users can export either the active view or the entire model based on their selection. The IDS4Revit exporter tool utilizes Revit’s standard IFC exporter for the export process.

![IDS4Revit Export to IFC](../../../assets\images\GIFs\2.5.2-IDS4Revit-ExportToIFC.gif)  
<sub>Note: the version on the image may not reflect the [latest version of IDS4Revit]().</sub>

---

### Sample Cases

DiRoots provides sample IDS files that support IFC versions IFC 2x3, IFC 4, and IFC 4x3 ADD2. If no IDS file is loaded, users can select a sample file from the interface. These samples can be used for reference to better understand how the tool works.

![IDS4Revit Sample Cases](../../../assets\images\GIFs\2.7-IDS4Revit-SampleCases.gif)  
<sub>Note: the version on the image may not reflect the [latest version of IDS4Revit]().</sub>

---

If you want to find out more about ProSheets and explore detailed tutorials on how to use it, visit our YouTube channel. There, you’ll find a series of videos that can help answer questions and improve your knowledge. Be sure to check it out and subscribe to keep up to date with our news and tips!

[DiRoots Channel](https://www.youtube.com/@DiRootsNews){: .btn .btn-di-orange }