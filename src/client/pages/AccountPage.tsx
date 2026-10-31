import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Navbar from "../components/Navbar";
import { forgetKeys } from "../identity/keystore";
import { DEFAULT_AVATAR, setMe, useMe } from "../me";
import "./styles/account-page.css";

const AVATAR_SIZE = 256;

async function shrinkImage(file: File) {
  let image: ImageBitmap;
  try {
    image = await createImageBitmap(file);
  } catch {
    throw new Error("That file doesn't look like an image.");
  }

  const side = Math.min(image.width, image.height);
  const x = (image.width - side) / 2;
  const y = (image.height - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  canvas
    .getContext("2d")!
    .drawImage(image, x, y, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  image.close();

  return canvas.toDataURL("image/jpeg", 0.85);
}

async function errorFrom(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  return body?.error ?? fallback;
}

async function logout() {
  await fetch("/api/auth/signout", { method: "POST" }).catch(() => null);
  await forgetKeys();
  window.location.assign("/");
}

export function AccountPage() {
  const me = useMe();
  const fileInput = useRef<HTMLInputElement>(null);
  const [newUsername, setNewUsername] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function show(text: string, isError = false) {
    setMessage(isError ? "" : text);
    setError(isError ? text : "");
  }

  async function saveAvatar(avatar: string | null) {
    if (!me) return;
    setSaving(true);
    const response = await fetch("/api/auth/avatar", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatar }),
    });
    setSaving(false);

    if (!response.ok) {
      show(await errorFrom(response, "could not update your pic."), true);
      return;
    }
    setMe({ ...me, avatar });
    show(avatar ? "profile pic updated." : "Profile pic removed.");
  }

  async function pickAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      await saveAvatar(await shrinkImage(file));
    } catch (err) {
      show(
        err instanceof Error ? err.message : "couldn't read that image.",
        true,
      );
    }
  }

  async function changeUsername(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!me) return;

    const response = await fetch("/api/auth/username", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newUsername }),
    });

    if (!response.ok) {
      show(await errorFrom(response, "couldn't update your username."), true);
      return;
    }
    setMe({ ...me, username: newUsername.trim() });
    setNewUsername("");
    show("Username updated.");
  }


  if (me === undefined) {
    return (
      <div className="main account-page">
        <Navbar />
        <p className="account-note">Loading...</p>
      </div>
    );
  }

  if (me === null) {
    return (
      <div className="main account-page">
        <Navbar />
        <div className="account">
          <p className="account-note">
            Your session has expired. Log out and sign in again.
          </p>
          <button className="account-logout" onClick={() => void logout()}>
            Log out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="main account-page">
      <Navbar />

      <div className="account">
        <h1 className="section-title">Account</h1>

        <div className="account-profile">
          <img
            className="account-avatar"
            src={me.avatar ?? DEFAULT_AVATAR}
            alt="Your profile"
          />
          <div className="account-name">
            <h2>{me.codename}</h2>
            <p>@{me.username}</p>
            <div className="account-avatar-actions">
              <button
                onClick={() => fileInput.current?.click()}
                disabled={saving}
              >
                {saving ? "Saving..." : "Change pic"}
              </button>
              {me.avatar && (
                <button
                  className="link"
                  onClick={() => void saveAvatar(null)}
                  disabled={saving}
                >
                  Remove
                </button>
              )}
            </div>
            <input
              ref={fileInput}
              type="file"
              accept="image/png, image/jpeg, image/webp"
              onChange={(event) => void pickAvatar(event)}
              hidden
            />
          </div>
        </div>

        {me.role === "unverified" && (
          <p className="account-message">
            Your account is waiting to be verified. Until then you can only use
            the home page.
          </p>
        )}
        {message && (
          <p className="account-message" role="status">
            {message}
          </p>
        )}
        {error && (
          <p className="account-error" role="alert">
            {error}
          </p>
        )}

        <dl className="account-details">
          <dt>Username</dt>
          <dd>{me.username}</dd>
          <dt>Codename</dt>
          <dd>{me.codename}</dd>
          <dt>Role</dt>
          <dd className="account-role">{me.role}</dd>
          <dt>Agent key</dt>
          <dd className="break">{me.agent}</dd>
        </dl>

        <form
          className="account-form"
          onSubmit={(event) => void changeUsername(event)}
        >
          <h3>Change username</h3>
          <label>
            New username
            <input
              value={newUsername}
              onChange={(event) => setNewUsername(event.target.value)}
              minLength={3}
              maxLength={32}
              pattern="[A-Za-z0-9_\-]+"
              title="Letters, numbers, _ and - only"
              required
            />
          </label>
          <button type="submit">Update username</button>
        </form>

        <div className="account-footer">
          <button className="account-logout" onClick={() => void logout()}>
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}
