import argparse
import subprocess


def run(cmd):
    subprocess.run(cmd, check=True)


def main():
    parser = argparse.ArgumentParser(description="Direct push using local Git credentials.")
    parser.add_argument("--repo", default="", help="GitHub repo URL (optional).")
    parser.add_argument("--branch", default="main", help="Branch name (default: main).")
    parser.add_argument("--message", default="Update project", help="Commit message.")
    args = parser.parse_args()

    if args.repo:
        run(["git", "remote", "remove", "origin"])
        run(["git", "remote", "add", "origin", args.repo])

    run(["git", "status", "-sb"])
    run(["git", "add", "-A"])

    try:
        run(["git", "commit", "-m", args.message])
    except subprocess.CalledProcessError:
        print("No changes to commit.")

    run(["git", "push", "--set-upstream", "origin", args.branch])


if __name__ == "__main__":
    main()
