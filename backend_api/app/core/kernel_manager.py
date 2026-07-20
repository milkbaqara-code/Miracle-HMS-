import json
import os
import logging
from pathlib import Path
from typing import Dict, Any, List

logger = logging.getLogger("KernelManager")

class KernelManager:
    _instance = None
    _kernel_data = {}
    _last_mtime = 0
    _kernel_path = Path("miracle_kernel.json")

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(KernelManager, cls).__new__(cls)
            cls._instance._load_kernel()
        return cls._instance

    def _load_kernel(self):
        """Loads the kernel from JSON file with safety checks."""
        try:
            if not self._kernel_path.exists():
                # Fallback if pathing is weird (e.g. running from different CWD)
                root_path = Path(__file__).parent.parent.parent.parent / "miracle_kernel.json"
                if root_path.exists():
                    self._kernel_path = root_path
                else:
                    logger.error(f"Kernel file not found at {self._kernel_path}")
                    return

            mtime = os.path.getmtime(self._kernel_path)
            if mtime > self._last_mtime:
                with open(self._kernel_path, "r", encoding="utf-8") as f:
                    self._kernel_data = json.load(f)
                self._last_mtime = mtime
                logger.info(f"✨ KERNEL RELOADED: Version {self._kernel_data.get('version', 'unknown')}")
        except Exception as e:
            logger.error(f"Failed to load kernel: {e}")

    def get_kernel(self) -> Dict[str, Any]:
        self._load_kernel()
        raw_kernel = self._kernel_data
        
        # If it's already in the expected flat dict format, return it
        if "Z-07" in raw_kernel:
            return raw_kernel
            
        # Otherwise, transform the array-based format into a flat zone dictionary
        transformed = {
            "version": raw_kernel.get("version", "V66.0 (Transformed)")
        }
        zones = raw_kernel.get("zones", [])
        
        for zone in zones:
            zone_id = zone.get("id")
            if not zone_id:
                continue
                
            ai_knowledge = zone.get("ai_knowledge", "")
            
            # Extract exact buttons from ai_knowledge string if present
            exact_buttons = []
            if "[EXACT UI BUTTONS:" in ai_knowledge:
                parts = ai_knowledge.split("[EXACT UI BUTTONS:")
                if len(parts) > 1:
                    btn_string = parts[1].split("]")[0].strip()
                    exact_buttons = [b.strip() for b in btn_string.split(",")]
                    ai_knowledge = parts[0].strip() # Remove the buttons section from operational knowledge
            
            transformed[zone_id] = {
                "name": zone.get("name", "Unknown Zone"),
                "path": zone.get("path"),
                "operational_knowledge": ai_knowledge,
                "exact_buttons": exact_buttons,
                "business_synonyms": {} # Empty for now, but avoids KeyError
            }
            
        return transformed

    def get_zone_library(self) -> Dict[str, Any]:
        """Returns the library formatted for the AI engine."""
        kernel = self.get_kernel()
        library = {}

        for zone_id, zone_data in kernel.items():
            if isinstance(zone_data, dict) and "name" in zone_data:
                # Use the path defined in the JSON, fallback to dashboard root
                zone_path = zone_data.get("path")
                if not zone_path:
                    zone_path = f"/dashboard/{zone_data.get('name', '').lower().split()[0]}"
                    
                library[zone_id] = {
                    "name": zone_data.get("name", "Unknown Zone"),
                    "path": zone_path,
                    "persona": "HMS CDO Intelligence",
                    "greeting_context": "",
                    "knowledge": "Expert on Miracle HMS platform."
                }
        
        # Ensure DEFAULT exists
        if "DEFAULT" not in library:
            library["DEFAULT"] = {
                "name": "Miracle HMS Dashboard",
                "path": "/dashboard",
                "persona": "HMS CDO Intelligence",
                "greeting_context": "You are the Chief Medical Officer of Miracle HMS. Guide with clinical authority.",
                "knowledge": "Expert on the entire Miracle HMS Sovereign clinical ecosystem."
            }
        return library

    def get_version(self) -> str:
        return self.get_kernel().get("version", "1.0.0")

kernel_manager = KernelManager()
