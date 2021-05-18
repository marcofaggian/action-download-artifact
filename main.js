const core = require("@actions/core");
const github = require("@actions/github");
const AdmZip = require("adm-zip");
const filesize = require("filesize");
const pathname = require("path");
const fs = require("fs");

async function main() {
  try {
    const token = core.getInput("github_token", { required: true });
    const workflow = core.getInput("workflow", { required: true });
    const [owner, repo] = core.getInput("repo", { required: true }).split("/");
    const paths = core.getInput("paths", { required: true }).split(" ");
    const names = core.getInput("names", { required: true }).split(" ");
    let pr = core.getInput("pr");
    let commit = core.getInput("commit");
    let branch = core.getInput("branch");
    let event = core.getInput("event");

    const client = github.getOctokit(token);

    console.log("==> Workflow:", workflow, token);

    console.log("==> Repo:", owner + "/" + repo);

    if (pr) {
      console.log("==> PR:", pr);

      const pull = await client.pulls.get({
        owner: owner,
        repo: repo,
        pull_number: pr
      });
      commit = pull.data.head.sha;
    }

    if (commit) {
      console.log("==> Commit:", commit);
    }

    if (branch) {
      branch = branch.replace(/^refs\/heads\//, "");
      console.log("==> Branch:", branch);
    }

    if (event) {
      console.log("==> Event:", event);
    }

    let artifacts = [];
    for await (const runs of client.paginate.iterator(
      client.actions.listWorkflowRuns,
      {
        owner: owner,
        repo: repo,
        workflow_id: workflow,
        branch: branch,
        event: event
      }
    )) {
      const run = runs.data.find(async (r) => {
        let viableArtifacts = await client.actions.listWorkflowRunArtifacts({
          owner: owner,
          repo: repo,
          run_id: r.id
        });
        if (viableArtifacts.data.artifacts.length) {
          console.log("found artifacts in run:", r.id, r.run_number);
          viableArtifacts = viableArtifacts.data.artifacts.filter((artifact) =>
            names.includes(artifact.name)
          );
          artifacts = [
            ...names.map((n) =>
              [...artifacts, ...viableArtifacts].find((a) => a.name === n)
            )
          ];
          if (artifacts.length === names.length) {
            return true;
          }
        }
      });
      if (run && run.id) {
        break;
      }
    }

    if (!artifacts.length) {
      throw new Error("no artifacts found");
    }

    for (const [i, artifact] of artifacts.entries()) {
      console.log("==> Artifact:", artifact.id);

      const size = filesize(artifact.size_in_bytes, { base: 10 });

      console.log(`==> Downloading: ${artifact.name}.zip (${size})`);

      const zip = await client.actions.downloadArtifact({
        owner: owner,
        repo: repo,
        artifact_id: artifact.id,
        archive_format: "zip"
      });

      const dir = paths[i];

      fs.mkdirSync(dir, { recursive: true });

      const adm = new AdmZip(Buffer.from(zip.data));

      adm.getEntries().forEach((entry) => {
        const action = entry.isDirectory ? "creating" : "inflating";
        const filepath = pathname.join(dir, entry.entryName);

        console.log(`  ${action}: ${filepath}`);
      });

      adm.extractAllTo(dir, true);
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

main();
