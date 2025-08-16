
public class CircularQueue {
    public final int max = 5;
    public int[] arr = new int[max];
    public int F = -1, R = -1;

    public void enqueue(int data) {
        if ((R + 1) % max == F) {
            System.out.println("Queue Overflow!");
            return;
        } else if (F == -1) {
            F = R = 0;
        } else {
            R = (R + 1) % max;
        }
        arr[R] = data;
        System.out.println("Inserted: " + data);
    }

    public void dequeue() {
        if (F == -1) {
            System.out.println("Queue Underflow!");
            return;
        }
        int deleted = arr[F];
        if (F == R) {
            F = R = -1;
        } else {
            F = (F + 1) % max;
        }
        System.out.println("Deleted: " + deleted);
    }

    public void display() {
        if (F == -1) {
            System.out.println("Queue is Empty!");
            return;
        }
        System.out.print("Queue Elements: ");
        int i = F;
        while (true) {
            System.out.print(arr[i] + " ");
            if (i == R) break;
            i = (i + 1) % max;
        }
        System.out.println();
    }

    public static void main(String[] args) {
        CircularQueue q = new CircularQueue();
        q.enqueue(10);
        q.enqueue(20);
        q.enqueue(30);
        q.enqueue(40);
        q.enqueue(50);
        q.display();
        q.dequeue();
        q.dequeue();
        q.display();
        q.enqueue(60);
        q.enqueue(70);
        q.display();
    }
}
