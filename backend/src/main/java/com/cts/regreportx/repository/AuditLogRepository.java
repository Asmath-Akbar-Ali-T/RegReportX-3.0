package com.cts.regreportx.repository;

import com.cts.regreportx.model.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, Integer> {

    List<AuditLog> findAllByOrderByTimestampDesc();

    List<AuditLog> findByUser_RoleOrderByTimestampDesc(String role);
}
