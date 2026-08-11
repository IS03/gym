import type { MetadataRoute } from "next";
import { ownlevelManifest } from "@/lib/brand-metadata";

export default function manifest(): MetadataRoute.Manifest {
  return ownlevelManifest();
}
