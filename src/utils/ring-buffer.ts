export class RingBuffer {
  private buffer: Buffer;
  private writePos: number = 0;
  private readPos: number = 0;
  private size: number;
  private filled: boolean = false;

  constructor(size: number) {
    this.size = size;
    this.buffer = Buffer.allocUnsafe(size);
  }

  write(data: Buffer): boolean {
    const dataLength = data.length;
    
    if (dataLength > this.size) {
      return false; // Data too large for buffer
    }

    // Check if we have enough space without overwriting unread data
    const availableSpace = this.getAvailableSpace();
    const willOverwrite = dataLength > availableSpace;
    
    const endSpace = this.size - this.writePos;
    
    if (dataLength <= endSpace) {
      // Data fits in one contiguous block
      data.copy(this.buffer, this.writePos);
      this.writePos += dataLength;
    } else {
      // Data wraps around
      data.copy(this.buffer, this.writePos, 0, endSpace);
      data.copy(this.buffer, 0, endSpace);
      this.writePos = dataLength - endSpace;
    }

    if (this.writePos === this.size) {
      this.writePos = 0;
    }

    // Adjust read position if we've overwritten unread data
    if (willOverwrite) {
      // We've overwritten some unread data, need to adjust read position
      this.readPos = this.writePos;
      this.filled = true;
    }

    return true;
  }

  read(size: number): Buffer | null {
    const available = this.getAvailableData();
    
    if (size > available) {
      return null; // Not enough data
    }

    const result = Buffer.allocUnsafe(size);
    const endSpace = this.size - this.readPos;

    if (size <= endSpace) {
      // Data is contiguous
      this.buffer.copy(result, 0, this.readPos, this.readPos + size);
      this.readPos += size;
    } else {
      // Data wraps around
      this.buffer.copy(result, 0, this.readPos, this.size);
      this.buffer.copy(result, endSpace, 0, size - endSpace);
      this.readPos = size - endSpace;
    }

    if (this.readPos === this.size) {
      this.readPos = 0;
    }

    if (this.readPos === this.writePos) {
      this.filled = false;
    }

    return result;
  }

  readAll(): Buffer {
    const available = this.getAvailableData();
    if (available === 0) {
      return Buffer.alloc(0);
    }
    return this.read(available)!;
  }

  peek(size: number): Buffer | null {
    const available = this.getAvailableData();
    
    if (size > available) {
      return null;
    }

    const result = Buffer.allocUnsafe(size);
    const endSpace = this.size - this.readPos;

    if (size <= endSpace) {
      this.buffer.copy(result, 0, this.readPos, this.readPos + size);
    } else {
      this.buffer.copy(result, 0, this.readPos, this.size);
      this.buffer.copy(result, endSpace, 0, size - endSpace);
    }

    return result;
  }

  flush(): Buffer {
    const data = this.readAll();
    this.clear();
    return data;
  }

  clear(): void {
    this.writePos = 0;
    this.readPos = 0;
    this.filled = false;
  }

  private getAvailableSpace(): number {
    if (this.filled) {
      return 0;
    }
    
    if (this.writePos >= this.readPos) {
      return this.size - this.writePos + this.readPos;
    } else {
      return this.readPos - this.writePos;
    }
  }

  private getAvailableData(): number {
    if (this.filled) {
      return this.size;
    }
    
    if (this.writePos >= this.readPos) {
      return this.writePos - this.readPos;
    } else {
      return this.size - this.readPos + this.writePos;
    }
  }

  getSize(): number {
    return this.size;
  }

  getUsedSpace(): number {
    return this.getAvailableData();
  }

  getFreeSpace(): number {
    return this.getAvailableSpace();
  }
}