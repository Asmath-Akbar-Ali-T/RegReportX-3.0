package com.cts.regreportx.controller;

import com.cts.regreportx.dto.UserDTO;
import com.cts.regreportx.model.User;
import com.cts.regreportx.repository.UserRepository;
import org.modelmapper.ModelMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/admin/users")
@PreAuthorize("hasRole('REGTECH_ADMIN')")
public class UserController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final ModelMapper modelMapper;

    @Autowired
    public UserController(UserRepository userRepository, PasswordEncoder passwordEncoder, ModelMapper modelMapper) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.modelMapper = modelMapper;
    }

    @GetMapping
    public ResponseEntity<List<UserDTO>> getAllUsers() {
        return ResponseEntity.ok(userRepository.findAll().stream()
                .map(user -> modelMapper.map(user, UserDTO.class))
                .collect(Collectors.toList()));
    }

    @PostMapping
    public ResponseEntity<?> createUser(@RequestBody UserDTO request) {
        if (request.getEmail() == null || request.getPassword() == null || request.getRole() == null) {
            return ResponseEntity.badRequest().body("Missing required fields");
        }

        Optional<User> existingUser = userRepository.findByEmail(request.getEmail());
        if (existingUser.isPresent()) {
            return ResponseEntity.badRequest().body("User with this email already exists");
        }

        String hashedPassword = passwordEncoder.encode(request.getPassword());

        User newUser = new User();
        newUser.setUsername(request.getUsername());
        newUser.setName(request.getName());
        newUser.setEmail(request.getEmail());
        newUser.setPassword(hashedPassword);
        newUser.setRole(request.getRole());
        newUser.setStatus(request.getStatus() != null ? request.getStatus() : "ACTIVE");

        userRepository.save(newUser);

        return ResponseEntity.ok(Map.of("message", "User created successfully", "userId", newUser.getId()));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateUser(@PathVariable Long id, @RequestBody UserDTO request) {
        Optional<User> userOptional = userRepository.findById(id);
        if (userOptional.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        User user = userOptional.get();
        if (request.getName() != null)
            user.setName(request.getName());
        if (request.getEmail() != null) {
            Optional<User> emailCheck = userRepository.findByEmail(request.getEmail());
            if (emailCheck.isPresent() && !emailCheck.get().getId().equals(id)) {
                return ResponseEntity.badRequest().body("Email already in use by another account");
            }
            user.setEmail(request.getEmail());
        }
        if (request.getRole() != null) {
            user.setRole(request.getRole());
        }
        if (request.getUsername() != null) {
            user.setUsername(request.getUsername());
        }

        if (request.getPassword() != null && !request.getPassword().isEmpty()
                && !request.getPassword().startsWith("$2a$")) {
            user.setPassword(passwordEncoder.encode(request.getPassword()));
        }

        userRepository.save(user);

        return ResponseEntity.ok(Map.of("message", "User updated successfully"));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteUser(@PathVariable Long id) {
        Optional<User> userOptional = userRepository.findById(id);
        if (userOptional.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        userRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "User deleted successfully"));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<?> toggleUserStatus(@PathVariable Long id) {
        Optional<User> userOptional = userRepository.findById(id);
        if (userOptional.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        User user = userOptional.get();
        if ("ACTIVE".equals(user.getStatus())) {
            user.setStatus("INACTIVE");
        } else {
            user.setStatus("ACTIVE");
        }

        userRepository.save(user);
        return ResponseEntity
                .ok(Map.of("message", "User status updated to " + user.getStatus(), "status", user.getStatus()));
    }
}
