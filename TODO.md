## Backlog

### Must have
- `staleOk` (return cached version, fetch fresh data in background)
- `chownr` cache files
- serve cached version on error if it is allowed by maxAge
- API for purging cache items, so that the npm client can clean the cache
  after a package was published or unpublished
- API for `/-/all` that is updated incrementally via

        /-/all/since?stale=update_after&startkey={time}

### Should have

- cookie jar

### Could have
- follow redirects (configurable)
- strip some headers like cookies when saving to cache
