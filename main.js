const core = require("@actions/core");
const github = require("@actions/github");
const AdmZip = require("adm-zip");
const filesize = require("filesize");
const pathname = require("path");
const fs = require("fs");

async function main() {
  try {
    const token = core.getInput("github_token", { required: true });
    const [owner, repo] = core.getInput("repo", { required: true }).split("/");
    const maxPages = core.getInput("maxPages") || 20;
    const per_page = core.getInput("perPage") || 200;

    const paths = core.getInput("paths", { required: true }).split(" ");
    const names = core.getInput("names", { required: true }).split(" ");
    const selectedArtifacts = names.reduce(
      (acc, name) => ({ ...acc, [name]: null }),
      {}
    );

    const client = github.getOctokit(token);

    console.log("==> Repo:", owner + "/" + repo);

    for (let page = 0; page < maxPages; page++) {
      const {
        data: { artifacts }
      } = await client.actions.listArtifactsForRepo({
        order: "desc",
        owner,
        repo,
        page,
        per_page
      });
      names.forEach(
        (selected) =>
          (selectedArtifacts[selected] = artifacts.find(
            ({ name }) => name === selected
          ))
      );
      if (!Object.values(selectedArtifacts).filter((v) => v === null).length) {
        break;
      }
    }

    if (!Object.values(selectedArtifacts).length) {
      throw new Error("no artifacts found");
    }

    console.log(
      "Selected artifacts",
      JSON.stringify(selectedArtifacts, null, 2)
    );

    for (const [i, artifact] of Object.values(selectedArtifacts).entries()) {
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
