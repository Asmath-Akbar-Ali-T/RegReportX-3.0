package com.cts.regreportx.controller;

import com.cts.regreportx.dto.RegTemplateDTO;
import com.cts.regreportx.dto.TemplateFieldDTO;
import com.cts.regreportx.model.RegTemplate;
import com.cts.regreportx.model.TemplateField;
import com.cts.regreportx.service.TemplateService;
import org.modelmapper.ModelMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/templates")
@PreAuthorize("hasRole('REGTECH_ADMIN')")
public class TemplateController {

    private final TemplateService templateService;
    private final ModelMapper modelMapper;

    @Autowired
    public TemplateController(TemplateService templateService, ModelMapper modelMapper) {
        this.templateService = templateService;
        this.modelMapper = modelMapper;
    }

    @GetMapping
    public ResponseEntity<List<RegTemplateDTO>> getAllTemplates() {
        return ResponseEntity.ok(templateService.getAllTemplates().stream()
                .map(t -> modelMapper.map(t, RegTemplateDTO.class))
                .collect(Collectors.toList()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<RegTemplateDTO> getTemplateById(@PathVariable Integer id) {
        return templateService.getTemplateById(id)
                .map(t -> ResponseEntity.ok(modelMapper.map(t, RegTemplateDTO.class)))
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<RegTemplateDTO> createTemplate(@RequestBody RegTemplateDTO templateDto) {
        RegTemplate template = modelMapper.map(templateDto, RegTemplate.class);
        RegTemplate saved = templateService.createTemplate(template);
        return ResponseEntity.ok(modelMapper.map(saved, RegTemplateDTO.class));
    }

    @PutMapping("/{id}")
    public ResponseEntity<RegTemplateDTO> updateTemplate(@PathVariable Integer id, @RequestBody RegTemplateDTO templateDto) {
        try {
            RegTemplate template = modelMapper.map(templateDto, RegTemplate.class);
            RegTemplate updated = templateService.updateTemplate(id, template);
            return ResponseEntity.ok(modelMapper.map(updated, RegTemplateDTO.class));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTemplate(@PathVariable Integer id) {
        templateService.deleteTemplate(id);
        return ResponseEntity.ok().build();
    }


    @GetMapping("/{templateId}/fields")
    public ResponseEntity<List<TemplateFieldDTO>> getFieldsByTemplateId(@PathVariable Integer templateId) {
        return ResponseEntity.ok(templateService.getFieldsByTemplateId(templateId).stream()
                .map(f -> modelMapper.map(f, TemplateFieldDTO.class))
                .collect(Collectors.toList()));
    }

    @PostMapping("/{templateId}/fields")
    public ResponseEntity<TemplateFieldDTO> addFieldToTemplate(
            @PathVariable Integer templateId,
            @RequestBody TemplateFieldDTO fieldDto) {
        TemplateField field = modelMapper.map(fieldDto, TemplateField.class);
        TemplateField saved = templateService.addFieldToTemplate(templateId, field);
        return ResponseEntity.ok(modelMapper.map(saved, TemplateFieldDTO.class));
    }

    @PutMapping("/fields/{fieldId}")
    public ResponseEntity<TemplateFieldDTO> updateField(@PathVariable Integer fieldId, @RequestBody TemplateFieldDTO fieldDto) {
        try {
            TemplateField field = modelMapper.map(fieldDto, TemplateField.class);
            TemplateField updated = templateService.updateField(fieldId, field);
            return ResponseEntity.ok(modelMapper.map(updated, TemplateFieldDTO.class));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/fields/{fieldId}")
    public ResponseEntity<Void> deleteField(@PathVariable Integer fieldId) {
        templateService.deleteField(fieldId);
        return ResponseEntity.ok().build();
    }
}
