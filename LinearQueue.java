public class LinearQueue {
    public final int max = 5;
    public int[] arr = new int[max];
    public int F = -1, R = -1;

    // Enqueue
    public void enqueue(int data) {
        if (R == max - 1) {
            System.out.println("Queue Overflow!");
            return;
        }
        if (F == -1) {
            F = R = 0;
        } else {
            R++;
        }
        arr[R] = data;
        System.out.println("Inserted: " + data);
    }

    // Dequeue
    public void dequeue() {
        if (F == -1) {
            System.out.println("Queue Underflow!");
            return;
        }
        int deleted = arr[F];
        if (F == R) {
            F = R = -1;
        } else {
            F++;
        }
        System.out.println("Deleted: " + deleted);
    }

    // Display
    public void display() {
        if (F == -1) {
            System.out.println("Queue is Empty!");
            return;
        }
        System.out.print("Queue Elements: ");
        for (int i = F; i <= R; i++) {
            System.out.print(arr[i] + " -> ");
        }
        System.out.println();
    }

    public static void main(String[] args) {
        LinearQueue q = new LinearQueue();
        q.enqueue(10);
        q.enqueue(20);
        q.enqueue(30);
        q.enqueue(40);
        q.enqueue(50);
        q.display();

        q.dequeue();
        q.dequeue();
        q.display();

        q.enqueue(60); // ❌ Won’t insert (Overflow)
    }
}
