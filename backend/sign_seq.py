import numpy as np

from gcs_storage import read_pickle

# GCS path prefix for pickle files
GCS_PKL_PREFIX = "sgsl_processed/landmarks_pkl"

class SignSequenceManager:
    def __init__(self):
        print(f"[SignSequenceManager] Loading landmark pickles from GCS: {GCS_PKL_PREFIX}")

    def _load_pkl_data(self, sign_name: str):
        """Load pickle data from GCS."""
        gcs_path = f"{GCS_PKL_PREFIX}/{sign_name}.pkl"
        print(f"[SignSequenceManager] Loading from GCS: {gcs_path}")
        data = read_pickle(gcs_path)
        if data is None:
            print(f"[SignSequenceManager] Sign data not found in GCS for {sign_name}")
        return data

    def _load_pkl_data_full_body_pose(self, sign_name: str):
        """Load full-body pose pickle data from GCS."""
        pose_filename = f"{sign_name}_full_body_pose.pkl"
        gcs_path = f"{GCS_PKL_PREFIX}/{pose_filename}"
        print(f"[SignSequenceManager] Loading full-body pose from GCS: {gcs_path}")
        data = read_pickle(gcs_path)
        if data is None:
            print(f"[SignSequenceManager] Full-body pose data not found in GCS for {sign_name}")
        return data

    def get_sign_frames(self, sign_name: str):
        """
        Load frames for a given sign.
        Returns: {
            "frames": [
                { "left": [[x,y,z]...], "right": [[x,y,z]...] },
                ...
            ],
            "L_orig": int,
            "L_max": int
        }
        """
        data = self._load_pkl_data(sign_name)
        if data is None:
            return None
            
        # Data X is (L, 126). 
        # 0-62 = Left flattened. 63-125 = Right flattened.
        X = data["X"]
        L, D = X.shape
        
        # Filter out zero-padded frames first
        non_zero_frames = []
        for t in range(L):
            row = X[t]
            if np.any(row != 0):
                non_zero_frames.append(row)
        
        if len(non_zero_frames) == 0:
            print(f"[get_sign_frames] {sign_name}: No non-zero frames found")
            return None
        
        # Stack into array for normalization
        X_filtered = np.array(non_zero_frames)
        
        # Normalize to 0-1 range
        # Find global min/max across all non-zero values
        X_nonzero = X_filtered[X_filtered != 0]
        if len(X_nonzero) > 0:
            x_min = X_nonzero.min()
            x_max = X_nonzero.max()
            print(f"[get_sign_frames] {sign_name}: Data range [{x_min:.4f}, {x_max:.4f}]")
            
            # Normalize: (x - min) / (max - min)
            X_normalized = np.zeros_like(X_filtered)
            mask = X_filtered != 0
            X_normalized[mask] = (X_filtered[mask] - x_min) / (x_max - x_min)
        else:
            X_normalized = X_filtered
        
        # Convert to frames
        frames_out = []
        for row in X_normalized:
            lh_flat = row[:63]
            rh_flat = row[63:]
            
            # Reshape (21, 3)
            lh = np.round(lh_flat.reshape(21, 3), 4).tolist()
            rh = np.round(rh_flat.reshape(21, 3), 4).tolist()
            
            frames_out.append({
                "left": lh,
                "right": rh
            })
        
        print(f"[get_sign_frames] {sign_name}: {len(frames_out)} non-zero frames out of {L} total")
            
        return {
            "frames": frames_out,
            "L_orig": data.get("L_orig", L),
            "L_max": data.get("L_max", L)
        }

    def get_sign_pose_frames(self, sign_name: str):
        """
        Load full body pose frames for a given sign.
        Checks for {sign_name}.pkl and converts hand data to pose-like format.
        Returns: {
            "frames": [
                { "pose": [[x,y,z]...] },  # landmarks per frame
                ...
            ],
            "L_orig": int,
            "L_max": int
        }
        """
        data = self._load_pkl_data(sign_name)
        if data is None:
            return None
            
        X = data["X"]
        L, D = X.shape
        print(f"Data shape: ({L}, {D})")
        
        # Check data format based on dimension
        if D == 99:
            # Full body pose data: 33 landmarks × 3 coordinates
            frames_out = []
            for t in range(L):
                row = X[t]
                pose = np.round(row.reshape(33, 3), 4).tolist()
                frames_out.append({"pose": pose})
            
            return {
                "frames": frames_out,
                "L_orig": data.get("L_orig", L),
                "L_max": data.get("L_max", L)
            }
        elif D == 126:
            # Hand-only data: 21 landmarks × 3 coordinates × 2 hands
            # Convert to a format with left and right hand landmarks
            print(f"Converting hand data (126 elements) to pose format")
            
            # Filter out zero-padded frames first
            non_zero_frames = []
            for t in range(L):
                row = X[t]
                if np.any(row != 0):
                    non_zero_frames.append(row)
            
            if len(non_zero_frames) == 0:
                print(f"[get_sign_pose_frames] {sign_name}: No non-zero frames found")
                return None
            
            # Stack into array for normalization
            X_filtered = np.array(non_zero_frames)
            
            # Normalize to 0-1 range
            X_nonzero = X_filtered[X_filtered != 0]
            if len(X_nonzero) > 0:
                x_min = X_nonzero.min()
                x_max = X_nonzero.max()
                print(f"[get_sign_pose_frames] {sign_name}: Data range [{x_min:.4f}, {x_max:.4f}]")
                
                # Normalize: (x - min) / (max - min)
                X_normalized = np.zeros_like(X_filtered)
                mask = X_filtered != 0
                X_normalized[mask] = (X_filtered[mask] - x_min) / (x_max - x_min)
            else:
                X_normalized = X_filtered
            
            # Convert to frames
            frames_out = []
            for row in X_normalized:
                lh_flat = row[:63]
                rh_flat = row[63:]
                
                # Reshape to (21, 3) for each hand
                lh = np.round(lh_flat.reshape(21, 3), 4).tolist()
                rh = np.round(rh_flat.reshape(21, 3), 4).tolist()
                
                frames_out.append({
                    "left_hand": lh,
                    "right_hand": rh
                })
            
            print(f"[get_sign_pose_frames] {sign_name}: {len(frames_out)} non-zero frames out of {L} total")
            
            return {
                "frames": frames_out,
                "L_orig": data.get("L_orig", L),
                "L_max": data.get("L_max", L),
                "format": "hands"  # Indicate this is hand data
            }
        else:
            print(f"Unknown data format with {D} elements")
            return None

    def get_sign_full_body_pose_frames(self, sign_name: str):
        """
        Load full body pose frames from {sign_name}_full_body_pose.pkl.
        Returns raw 33x3 pose landmarks without normalization.
        Returns: {
            "frames": [
                { "pose": [[x,y,z]...] },  # 33 landmarks per frame
                ...
            ],
            "L_orig": int,
            "L_max": int
        }
        """
        data = self._load_pkl_data_full_body_pose(sign_name)
        if data is None:
            return None
            
        X = data["X"]
        L, D = X.shape
        print(f"[get_sign_full_body_pose_frames] {sign_name}: Data shape ({L}, {D})")
        
        # Full body pose data should be 33 landmarks × 3 coordinates = 99
        if D != 99:
            print(f"[get_sign_full_body_pose_frames] {sign_name}: Expected 99 dimensions, got {D}")
            return None
        
        # Convert to frames with raw coordinates (no normalization)
        # Filter out zero-padded frames
        frames_out = []
        for t in range(L):
            row = X[t]
            # Check if frame has any non-zero data
            if np.any(row != 0):
                # Reshape to (33, 3) - 33 pose landmarks with x, y, z coordinates
                pose = np.round(row.reshape(33, 3), 4).tolist()
                frames_out.append({"pose": pose})
        
        print(f"[get_sign_full_body_pose_frames] {sign_name}: {len(frames_out)} non-zero frames out of {L} total")
        
        if len(frames_out) == 0:
            print(f"[get_sign_full_body_pose_frames] {sign_name}: WARNING - No non-zero frames found!")
            return None
        
        return {
            "frames": frames_out,
            "L_orig": data.get("L_orig", L),
            "L_max": data.get("L_max", L)
        }
