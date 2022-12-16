"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = __importDefault(require("@actions/core"));
const github_1 = __importDefault(require("@actions/github"));
const adm_zip_1 = __importDefault(require("adm-zip"));
const filesize_1 = require("filesize");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const token = core_1.default.getInput("github_token", { required: true });
            const [owner, repo] = core_1.default.getInput("repo", { required: true }).split("/");
            const maxPages = Number(core_1.default.getInput("maxPages")) || 20;
            const per_page = Number(core_1.default.getInput("perPage")) || 200;
            const paths = core_1.default.getInput("paths", { required: true }).split(" ");
            const names = core_1.default.getInput("names", { required: true }).split(" ");
            const selectedArtifacts = names.reduce((acc, name) => (Object.assign(Object.assign({}, acc), { [name]: null })), {});
            const client = github_1.default.getOctokit(token);
            console.log("==> Repo:", owner + "/" + repo);
            // Scan all the pages
            for (let page = 0; page < maxPages; page++) {
                const { data: { artifacts } } = yield client.rest.actions.listArtifactsForRepo({
                    order: "desc",
                    owner,
                    repo,
                    page,
                    per_page
                });
                if (artifacts.length)
                    names.forEach((selected) => (selectedArtifacts[selected] = artifacts.find(({ name }) => name === selected)));
                if (!Object.values(selectedArtifacts).filter((v) => v === null).length) {
                    break;
                }
            }
            if (!Object.values(selectedArtifacts).length) {
                throw new Error("no artifacts found");
            }
            console.log("Selected artifacts", JSON.stringify(selectedArtifacts, null, 2));
            for (const [i, artifact] of Object.values(selectedArtifacts).entries()) {
                if (!artifact) {
                    throw new Error(`Artifact selected as "${i}" is undefined`);
                }
                console.log("==> Artifact:", artifact.id);
                const size = (0, filesize_1.filesize)(artifact === null || artifact === void 0 ? void 0 : artifact.size_in_bytes, { base: 10 });
                console.log(`==> Downloading: ${artifact.name}.zip (${size})`);
                const zip = yield client.rest.actions.downloadArtifact({
                    owner: owner,
                    repo: repo,
                    artifact_id: artifact.id,
                    archive_format: "zip"
                });
                if (!zip || !zip.data) {
                    throw new Error(`Unable to download artifact ${artifact.id}`);
                }
                const dir = paths[i];
                fs_1.default.mkdirSync(dir, { recursive: true });
                const adm = new adm_zip_1.default(Buffer.from(zip.data));
                adm.getEntries().forEach((entry) => {
                    const action = entry.isDirectory ? "creating" : "inflating";
                    const filepath = path_1.default.join(dir, entry.entryName);
                    console.log(`  ${action}: ${filepath}`);
                });
                adm.extractAllTo(dir, true);
            }
        }
        catch (error) {
            if (error instanceof Error) {
                core_1.default.setFailed(error.message);
            }
            else {
                core_1.default.setFailed(String(error));
            }
        }
    });
}
main();
