package prosno.backend.services;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.Refill;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class RateLimitingService {

    private final int maxRequests;
    private final int resetHours;

    private final Map<UUID, Bucket> cache = new ConcurrentHashMap<>();

    public RateLimitingService(
            @Value("${app.indexing.rate-limit.max-requests:5}") int maxRequests,
            @Value("${app.indexing.rate-limit.reset-hours:24}") int resetHours) {
        this.maxRequests = maxRequests;
        this.resetHours = resetHours;
    }

    public Bucket resolveBucket(UUID userId) {
        return cache.computeIfAbsent(userId, this::newBucket);
    }

    private Bucket newBucket(UUID userId) {
        Refill refill = Refill.intervally(maxRequests, Duration.ofHours(resetHours));
        Bandwidth limit = Bandwidth.classic(maxRequests, refill);
        return Bucket.builder().addLimit(limit).build();
    }
}
