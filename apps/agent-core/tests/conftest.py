from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def agent_core_client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("AGENT_CORE_TOKEN", "test-token")
    monkeypatch.setenv("DEEPSEEK_API_KEY", "")
    (tmp_path / "users").mkdir(parents=True)
    monkeypatch.setenv("AGENT_CORE_DATA_ROOT", str(tmp_path / "users"))

    yaml_path = tmp_path / "assistants.yaml"
    yaml_path.write_text(
        """assistants:
  me:
    agents:
      design:
        description: "Design test"
        keywords: [logo]
        model: deepseek-chat
        max_output: 100
        prompt_file: prompts/design.txt
      marketing:
        description: "Marketing test"
        keywords: [caption]
        model: deepseek-chat
        max_output: 100
        prompt_file: prompts/marketing.txt
  wife:
    agents:
      design:
        description: "Wife design"
        keywords: [logo]
        model: deepseek-chat
        max_output: 100
        prompt_file: prompts/design.txt
""",
        encoding="utf-8",
    )
    monkeypatch.setenv("ASSISTANTS_YAML", str(yaml_path))

    repo_root = Path(__file__).resolve().parent.parent
    monkeypatch.chdir(repo_root)

    import config

    config.load_assistants.cache_clear()

    from main import app

    with TestClient(app) as client:
        yield client
