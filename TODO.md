## Backlog

### Must have
- API for purging cache items, so that the npm client can clean the cache
  after a package was published or unpublished
- API for `/-/all` that is updated incrementally via

        /-/all/since?stale=update_after&startkey={time}

- proxy - http over http, https over http (CONNECT verb)
- Locking (maybe use [this concept](http://stackoverflow.com/a/18310623/69868)
  instead?)

### Should have

- cookie jar

### Could have
- follow redirects (configurable)
- strip some headers like cookies when saving to cache
- `chownr` cache files (?)
