import core from "@actions/core";
import github from "@actions/github";
import AdmZip from "adm-zip";
import { filesize } from "filesize";
import fs from "fs";
import pathname from "path";
import { SelectedArtifact } from "./types";

async function main() {
  try {
    const token = core.getInput("github_token", { required: true });
    const [owner, repo] = core.getInput("repo", { required: true }).split("/");
    const maxPages = Number(core.getInput("maxPages")) || 20;
    const per_page = Number(core.getInput("perPage")) || 200;

    const paths = core.getInput("paths", { required: true }).split(" ");
    const names = core.getInput("names", { required: true }).split(" ");
    const selectedArtifacts = names.reduce(
      (acc, name) => ({ ...acc, [name]: null }),
      {}
    ) as SelectedArtifact;

    const client = github.getOctokit(token);

    console.log("==> Repo:", owner + "/" + repo);

    // Scan all the pages
    for (let page = 0; page < maxPages; page++) {
      const {
        data: { artifacts }
      } = await client.rest.actions.listArtifactsForRepo({
        order: "desc",
        owner,
        repo,
        page,
        per_page
      });

      if (artifacts.length)
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
      if (!artifact) {
        throw new Error(`Artifact selected as "${i}" is undefined`);
      }
      console.log("==> Artifact:", artifact.id);

      const size = filesize(artifact?.size_in_bytes, { base: 10 });

      console.log(`==> Downloading: ${artifact.name}.zip (${size})`);

      const zip = await client.rest.actions.downloadArtifact({
        owner: owner,
        repo: repo,
        artifact_id: artifact.id,
        archive_format: "zip"
      });
      if (!zip || !zip.data) {
        throw new Error(`Unable to download artifact ${artifact.id}`);
      }

      const dir = paths[i];

      fs.mkdirSync(dir, { recursive: true });

      const adm = new AdmZip(Buffer.from(zip.data as ArrayBuffer));

      adm.getEntries().forEach((entry) => {
        const action = entry.isDirectory ? "creating" : "inflating";
        const filepath = pathname.join(dir, entry.entryName);

        console.log(`  ${action}: ${filepath}`);
      });

      adm.extractAllTo(dir, true);
    }
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed(String(error));
    }
  }
}

main();
