/**
 * 把远程图片存到系统相册。
 *
 * 分两步：先 downloadAsync 落到应用缓存目录，再交给 MediaLibrary —— 相册
 * 只收本地 URI，不能直接喂 http 地址。
 */
import * as FileSystem from "expo-file-system";
import * as MediaLibrary from "expo-media-library";

export type SaveImageResult =
  | { ok: true }
  | { ok: false; reason: "permission" | "failed" };

/** 从 URL 猜扩展名。相册按扩展名判断类型，给错了 iOS 会拒收。 */
function extFromUrl(url: string): string {
  const clean = url.split("?")[0].split("#")[0];
  const m = /\.(jpe?g|png|gif|webp|heic)$/i.exec(clean);
  return m ? m[1].toLowerCase() : "jpg";
}

export async function saveImageToLibrary(
  url: string,
): Promise<SaveImageResult> {
  // 只申请写入权限（writeOnly = true）。保存图片不需要读取整个相册，
  // 多要一个读权限在 iOS 上会弹更吓人的授权框，通过率更低。
  const perm = await MediaLibrary.requestPermissionsAsync(true);
  if (!perm.granted) return { ok: false, reason: "permission" };

  // 文件名带时间戳：同一张图允许存多次，也避免撞上缓存里的旧文件。
  const target = `${FileSystem.cacheDirectory}save-${Date.now()}.${extFromUrl(url)}`;
  try {
    const res = await FileSystem.downloadAsync(url, target);
    if (res.status !== 200) return { ok: false, reason: "failed" };

    await MediaLibrary.saveToLibraryAsync(res.uri);
    return { ok: true };
  } catch (e) {
    console.warn("[saveImage] 保存失败", e);
    return { ok: false, reason: "failed" };
  } finally {
    // 缓存目录系统不保证回收，落库成功与否都把临时文件删掉，
    // 不然用户存几十张图就白占几十 MB。
    FileSystem.deleteAsync(target, { idempotent: true }).catch(() => {});
  }
}
