// Setup-pose geometry of the attachments each pet look skin adds, for scripts/render-sts2-pet-look-tokens.py.
// Prints JSON: [{ folder, skin, parts: [{ page, world: [x,y,...], uvs: [u,v,...], triangles: [i,...] }] }] in draw order.
import fs from "node:fs";
import path from "node:path";
import * as spine from "@esotericsoftware/spine-player";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

// The looks the pet pages offer (src/lib/codex-data.ts PET_DEFS); eyes use Yummy Cookie art instead.
const LOOKS = {
  byrdpip: ["version1", "version2", "version3", "version4"],
  byrdine: ["hair/v1", "hair/v2", "hair/v3", "hair/v4"],
  paels_legion: ["eyes", "horns", "spikes", "wing"],
};

const out = [];
for (const [folder, skins] of Object.entries(LOOKS)) {
  const dir = path.join(repoRoot, "public/spine/sts2/monsters", folder);
  const atlas = new spine.TextureAtlas(fs.readFileSync(path.join(dir, `${folder}.atlas`), "utf8"));
  for (const page of atlas.pages) page.setTexture({ setFilters() {}, setWraps() {} });
  const data = new spine.SkeletonBinary(new spine.AtlasAttachmentLoader(atlas))
    .readSkeletonData(new Uint8Array(fs.readFileSync(path.join(dir, `${folder}.skel`))));
  for (const skinName of skins) {
    const skin = data.findSkin(skinName);
    const skeleton = new spine.Skeleton(data);
    const combined = new spine.Skin("token");
    if (data.defaultSkin) combined.addSkin(data.defaultSkin);
    combined.addSkin(skin);
    skeleton.setSkin(combined);
    skeleton.setToSetupPose();
    skeleton.updateWorldTransform(spine.Physics.update);
    const own = new Set(skin.getAttachments().map((entry) => entry.attachment));
    const parts = [];
    for (const slot of skeleton.drawOrder) {
      const attachment = slot.getAttachment();
      if (!own.has(attachment)) continue;
      let world;
      let triangles;
      if (attachment instanceof spine.RegionAttachment) {
        world = new Array(8).fill(0);
        attachment.computeWorldVertices(slot, world, 0, 2);
        triangles = [0, 1, 2, 2, 3, 0];
      } else if (attachment instanceof spine.MeshAttachment) {
        world = new Array(attachment.worldVerticesLength).fill(0);
        attachment.computeWorldVertices(slot, 0, attachment.worldVerticesLength, world, 0, 2);
        triangles = Array.from(attachment.triangles);
      } else continue;
      const page = attachment.region.page;
      parts.push({ page: page.name, world, uvs: Array.from(attachment.uvs), triangles });
    }
    out.push({ folder, skin: skinName, parts });
  }
}
process.stdout.write(JSON.stringify(out));
