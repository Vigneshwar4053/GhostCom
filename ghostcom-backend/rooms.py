import time
import threading

class Room:
    def __init__(self, code, expires_sec, owner):
        self.code = code
        self.created = time.time()
        self.expires_sec = expires_sec
        self.owner = owner
        self.members = set()
        self.messages = []
        self.last_activity = time.time()
        self.active = True
        # Skip timer for common room or if expires_sec is None
        if code != "COMMON" and expires_sec is not None:
            self.timer = threading.Timer(expires_sec, self.terminate)
            self.timer.start()
        else:
            self.timer = None

    def touch(self):
        self.last_activity = time.time()

    def terminate(self):
        self.active = False
        self.members.clear()
        self.messages.clear()

class RoomManager:
    def __init__(self):
        self.rooms = {}  # code: Room
        # Only one line to create "COMMON" room and never expires
        self.rooms["COMMON"] = Room("COMMON", None, owner="system")

    def create_room(self, code, expires_sec, owner):
        if code not in self.rooms:
            self.rooms[code] = Room(code, expires_sec, owner)
            return True
        return False

    def join_room(self, code, user):
        room = self.rooms.get(code)
        if room and room.active:
            room.members.add(user)
            room.touch()
            return True
        return False

    def leave_room(self, code, user):
        room = self.rooms.get(code)
        if room:
            room.members.discard(user)
            room.touch()
            if not room.members and code != "COMMON":
                room.terminate()

    def add_message(self, code, msg):
        room = self.rooms.get(code)
        if room and room.active:
            room.messages.append(msg)
            room.touch()
            return True
        return False

    def get_room(self, code):
        return self.rooms.get(code)

    def get_codes(self):
        return set(self.rooms.keys())

    def cleanup(self):
        # Remove inactive rooms except "common"
        for code in list(self.rooms.keys()):
            if code != "COMMON" and not self.rooms[code].active:
                del self.rooms[code]

room_manager = RoomManager()