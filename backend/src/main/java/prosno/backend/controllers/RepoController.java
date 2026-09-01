package prosno.backend.controllers;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import prosno.backend.dto.IndexStatusResponse;
import prosno.backend.dto.RepositoryResponse;
import prosno.backend.entity.Repository;
import prosno.backend.security.CurrentUser;
import prosno.backend.services.RepoService;
import prosno.backend.services.indexing.IndexingService;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/repos")
@RequiredArgsConstructor
public class RepoController {

    private final CurrentUser currentUser;
    private final RepoService repoService;

    private final IndexingService indexingService;

    @GetMapping
    public List<RepositoryResponse> list(
            @RequestParam(name = "refresh", defaultValue = "true") boolean refresh) {
        UUID userId = currentUser.require().getId();
        if (refresh) {
            return repoService.syncAndListRepos(userId);
        }
        return repoService.listStored(userId);
    }

    @GetMapping("/{id}")
    public RepositoryResponse get(@PathVariable UUID id) {
        UUID userId = currentUser.require().getId();
        return repoService.toResponse(repoService.requireOwned(id, userId));
    }

    @PostMapping("/{id}/index")
    public ResponseEntity<prosno.backend.dto.IndexTriggerResponse> index(@PathVariable UUID id) {
        return handleIndexOrRefresh(id);
    }

    @PostMapping("/{id}/refresh")
    public ResponseEntity<prosno.backend.dto.IndexTriggerResponse> refresh(@PathVariable UUID id) {
        return handleIndexOrRefresh(id);
    }

    private ResponseEntity<prosno.backend.dto.IndexTriggerResponse> handleIndexOrRefresh(UUID id) {
        UUID userId = currentUser.require().getId();
        String outcome = indexingService.tryStartIndexing(id, userId);
        
        if ("STARTED_INDEXING".equals(outcome)) {
            indexingService.indexAsync(id, userId);
        }
        
        Repository repo = repoService.requireOwned(id, userId);
        return ResponseEntity.status(HttpStatus.ACCEPTED)
            .body(new prosno.backend.dto.IndexTriggerResponse(repoService.toResponse(repo), outcome));
    }

    @GetMapping("/{id}/status")
    public IndexStatusResponse status(@PathVariable UUID id) {
        UUID userId = currentUser.require().getId();
        return repoService.status(id, userId);
    }

    @PostMapping("/add-public")
    public ResponseEntity<prosno.backend.dto.IndexTriggerResponse> addPublic(@org.springframework.web.bind.annotation.RequestBody prosno.backend.dto.AddPublicRepoRequest request) {
        UUID userId = currentUser.require().getId();
        
        RepoService.AddRepoResult result = repoService.addPublicRepo(userId, request.input());
        Repository repo = result.repo();
        
        String outcome = indexingService.tryStartIndexing(repo.getId(), userId);
        
        if ("STARTED_INDEXING".equals(outcome)) {
            indexingService.indexAsync(repo.getId(), userId);
            Repository updatedRepo = repoService.requireOwned(repo.getId(), userId);
            return ResponseEntity.status(HttpStatus.ACCEPTED)
                .body(new prosno.backend.dto.IndexTriggerResponse(repoService.toResponse(updatedRepo), outcome));
        } else {
            if (!result.isNew() && "ALREADY_UP_TO_DATE".equals(outcome)) {
                outcome = "ATTACHED_EXISTING";
            }
            Repository updatedRepo = repoService.requireOwned(repo.getId(), userId);
            return ResponseEntity.status(HttpStatus.OK)
                .body(new prosno.backend.dto.IndexTriggerResponse(repoService.toResponse(updatedRepo), outcome));
        }
    }

}