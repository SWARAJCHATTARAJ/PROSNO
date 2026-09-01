package prosno.backend.controllers;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import lombok.RequiredArgsConstructor;
import prosno.backend.services.indexing.IndexingService;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final IndexingService indexingService;
    private final prosno.backend.services.CleanupService cleanupService;

    @PostMapping("/force-reindex-all")
    public ResponseEntity<Map<String, String>> forceReindexAll() {
        // Run in background asynchronously
        indexingService.forceReindexAllReadyRepos();
        return ResponseEntity.accepted().body(Map.of("message", "Forced re-indexing of all READY repos has started in the background."));
    }

    @PostMapping("/cleanup")
    public ResponseEntity<Map<String, String>> triggerCleanup(
            @org.springframework.web.bind.annotation.RequestParam(name = "dryRun", defaultValue = "true") boolean dryRun) {
        
        // Run asynchronously to avoid blocking the HTTP request
        new Thread(() -> cleanupService.runCleanup(dryRun)).start();
        
        String msg = dryRun 
            ? "Dry-run cleanup started in the background. Check logs to see what WOULD be expired/deleted."
            : "Actual cleanup started in the background. Check logs for progress.";
        return ResponseEntity.accepted().body(Map.of("message", msg));
    }
}
