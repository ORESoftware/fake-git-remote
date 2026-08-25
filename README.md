# fake-git-remote

Create a real local bare Git repository for integration tests. The fixture uses
Git's local transport, so tests exercise clone, fetch, push, branches, and real
object IDs without network access or credentials.

```js
import { createFakeRemote } from '@oresoftware/fake-git-remote';

const fixture = await createFakeRemote({
  directory: '/an/isolated/test-directory',
  seedFiles: { 'contract.json': '{"version":1}\n' },
});
// fixture.remotePath is suitable for `git clone`.
```

The CLI prints exactly one JSON object to stdout:

```sh
fake-git-remote --directory /an/isolated/test-directory --name origin.git
```

Names, refs, and seed paths are validated before Git runs. Temporary seed
checkouts are created beneath the operating-system temporary directory and are
removed after the bare remote has received its first commit. Callers own the
requested fixture directory and its lifecycle.

## Verify

```sh
npm test
npm pack --dry-run --json
```

The test suite clones the generated remote into a separate consumer checkout
and verifies its exact commit and file contents; this is a real transport test,
not a mock or dry run.
