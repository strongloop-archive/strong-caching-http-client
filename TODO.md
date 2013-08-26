## Backlog

### Must have
- API for invalidating individual cache items, so that the npm client can
  remove cached data about a package after a new version was published
  (or a version was unpublished).
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
